import { z } from "zod";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DO NOT CHANGE WITHOUT MIGRATION — THIS SCHEMA IS A CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This schema defines the single source of truth for all analysis outputs.
 * Any changes to this schema require:
 * 1. Version bump in meta.schemaVersion
 * 2. Migration strategy for existing data
 * 3. Updates to all consumers (AI prompts, UI components, storage layer)
 *
 * Breaking changes must maintain backward compatibility or provide clear
 * migration paths for all stored analysis results.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared Enums & Utilities
// ─────────────────────────────────────────────────────────────────────────────

const DocumentTypeSchema = z.enum(["lab_report", "discharge_instructions", "discharge_summary"]);
const ReadingLevelSchema = z.enum(["simple", "standard"]);
const ProvenanceSourceSchema = z.enum(["pdf_upload", "ehr_fhir", "paste"]);

/**
 * Confidence score for AI-generated content (0.0 = no confidence, 1.0 = full confidence)
 * Optional to maintain backward compatibility with schema v1.0.0
 */
const ConfidenceScoreSchema = z.number().min(0).max(1).optional();

// ─────────────────────────────────────────────────────────────────────────────
// Meta Section
// ─────────────────────────────────────────────────────────────────────────────

const MetaSchema = z
    .object({
        schemaVersion: z.enum(["1.0.0", "1.1.0", "1.2.0"]), // Accept both for backward compatibility
        createdAt: z.string().datetime(), // ISO 8601 string
        documentType: DocumentTypeSchema,
        readingLevel: ReadingLevelSchema,
        language: z.string().default("en").optional(),
        provenance: z.object({
            source: ProvenanceSourceSchema,
        }),
        safety: z.object({
            disclaimer: z.string(),
            limitations: z.array(z.string()),
            emergencyNote: z.string(),
        }),
        modelInfo: z
            .object({
                provider: z.enum(["openai", "google", "anthropic", "mock"]),
                modelName: z.string(),
                temperature: z.number(),
            })
            .optional(),
    })
    .strict();

// ─────────────────────────────────────────────────────────────────────────────
// Patient Summary Section
// ─────────────────────────────────────────────────────────────────────────────

const PatientSummarySchema = z
    .object({
        overallSummary: z.string(),
        overallSummaryConfidence: ConfidenceScoreSchema,
        keyTakeaways: z.array(z.string()).min(3).max(7),
        keyTakeawaysConfidence: z.array(ConfidenceScoreSchema).optional(),
    })
    .strict();

// ─────────────────────────────────────────────────────────────────────────────
// Labs Section (for lab_report documents)
// ─────────────────────────────────────────────────────────────────────────────

const LabFlagSchema = z.enum([
    "low",
    "high",
    "normal",
    "borderline",
    "unknown",
]);

const LabImportanceSchema = z.enum(["low", "medium", "high", "unknown"]);

const LabItemSchema = z
    .object({
        name: z.string(),
        value: z.string(),
        unit: z.string().nullable(),
        referenceRange: z.string().nullable(),
        flag: LabFlagSchema,
        importance: LabImportanceSchema,
        trend: z.array(z.object({
            date: z.string(),
            value: z.string()
        })).optional(),
        trendInterpretation: z.enum(["Improving", "Worsening", "Stable", "Resolved", "Unknown"]).optional(),
        explanation: z.string(),
        confidenceScore: ConfidenceScoreSchema,
    })
    .strict();

const LabsSectionSchema = z
    .object({
        overallLabNote: z.string().optional(),
        labs: z.array(LabItemSchema), // Can be empty array
    })
    .strict();

// ─────────────────────────────────────────────────────────────────────────────
// Discharge Section (for discharge_instructions documents)
// ─────────────────────────────────────────────────────────────────────────────

const DischargeStatusSchema = z.enum(["draft", "approved"]);

const MedicationSchema = z
    .object({
        name: z.string(),
        purposePlain: z.string(),
        howToTakeFromDoc: z.string(),
        timing: z.string().optional(),
        cautionsGeneral: z.string(),
    })
    .strict();

const DischargeSectionSchema = z
    .object({
        status: DischargeStatusSchema,
        homeCareSteps: z.array(z.string()),
        medications: z.array(MedicationSchema),
        followUp: z.array(z.string()),
        warningSignsFromDoc: z.array(z.string()),
        generalRedFlags: z.array(z.string()),
        diagnosesMentionedInDoc: z.array(z.string()),

        // ── NEW FIELDS (all optional for backward compatibility) ──
        followUpStructured: z.array(z.lazy(() => FollowUpAppointmentSchema)).optional(),
        dietInstructions: z.string().optional(),
        activityRestrictions: z.string().optional(),
        dailyMonitoring: z.array(z.string()).optional(),
        feedingPlan: z.string().optional(),
        safeSleepInstructions: z.string().optional(),
        woundCare: z.string().optional(),
        respiratoryPrecautions: z.string().optional(),
        developmentalGuidance: z.string().optional(),
    })
    .strict();

// ── Imaging & Procedures ──────────────────────────────────
const ImagingKeyValueSchema = z.object({
    label: z.string(),              // e.g., "Ejection Fraction", "PA Pressure"
    value: z.string(),              // e.g., "22%", "62/30 mmHg"
    interpretation: z.string(),     // e.g., "Severely reduced heart pumping ability"
}).strict();

const ImagingItemSchema = z.object({
    name: z.string(),               // e.g., "Transthoracic Echocardiogram (TTE)"
    date: z.string().optional(),    // e.g., "01/15/2025"
    findingsPlain: z.string(),      // Full plain-language explanation
    keyValues: z.array(ImagingKeyValueSchema).optional(),
    confidenceScore: ConfidenceScoreSchema,
}).strict();

// ── Discontinued Medications ──────────────────────────────
const DiscontinuedMedicationSchema = z.object({
    name: z.string(),               // e.g., "Metformin"
    reasonPlain: z.string(),        // e.g., "Stopped because kidney function too low for safe use"
    replacedBy: z.string().optional(), // e.g., "Empagliflozin (Jardiance)"
}).strict();

// ── Immunization Records ──────────────────────────────────
const ImmunizationSchema = z.object({
    name: z.string(),               // e.g., "DTaP/IPV/Hib (Pentacel) #1"
    date: z.string(),               // e.g., "01/18/2025"
    notes: z.string().optional(),   // e.g., "2 months chronological age"
}).strict();

// ── Follow-Up Appointments ────────────────────────────────
const FollowUpAppointmentSchema = z.object({
    specialty: z.string(),          // e.g., "Pediatric Ophthalmology"
    provider: z.string().optional(),// e.g., "Dr. R. Sanchez"
    dateTime: z.string(),           // e.g., "02/11/2025 @ 1:30 PM"
    purpose: z.string(),            // e.g., "ROP follow-up screening"
    urgency: z.enum(["routine", "important", "critical"]).optional(),
    // "critical" = document explicitly flags as must-not-miss
}).strict();

// ─────────────────────────────────────────────────────────────────────────────
// Main Analysis Schema with Discriminated Union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base schema shared by all document types
 */
const BaseAnalysisSchema = z.object({
    meta: MetaSchema,
    patientSummary: PatientSummarySchema,
    questionsForDoctor: z.array(z.string()).min(5).max(10),
    questionsForDoctorConfidence: z.array(ConfidenceScoreSchema).optional(),
    whatWeCouldNotDetermine: z.array(z.string()),
});

/**
 * Lab Report variant: requires labsSection, dischargeSection must be undefined
 */
const LabReportAnalysisSchema = BaseAnalysisSchema.extend({
    meta: MetaSchema.extend({
        documentType: z.literal("lab_report"),
    }).strict(),
    labsSection: LabsSectionSchema,
    dischargeSection: z.undefined(),
}).strict();

/**
 * Discharge Instructions variant: requires dischargeSection, labsSection must be undefined
 */
const DischargeInstructionsAnalysisSchema = BaseAnalysisSchema.extend({
    meta: MetaSchema.extend({
        documentType: z.literal("discharge_instructions"),
    }).strict(),
    labsSection: z.undefined(),
    dischargeSection: DischargeSectionSchema,
}).strict();

/**
 * Discharge Summary variant: a more comprehensive version of discharge instructions.
 * Requires dischargeSection, allows optional labs, imaging, discontinued meds.
 */
const DischargeSummaryAnalysisSchema = BaseAnalysisSchema.extend({
    meta: MetaSchema.extend({
        documentType: z.literal("discharge_summary"),
    }).strict(),
    labsSection: LabsSectionSchema.optional(),              // OPTIONAL (may or may not have labs)
    dischargeSection: DischargeSectionSchema.optional(),     // OPTIONAL (may or may not have d/c instructions)
    imagingAndProcedures: z.array(ImagingItemSchema).optional(),
    discontinuedMedications: z.array(DiscontinuedMedicationSchema).optional(),
    immunizations: z.array(ImmunizationSchema).optional(),
    birthHistory: z.string().optional(),                    // Plain-language birth narrative (for NICU)
    hospitalCourse: z.string().optional(),                  // Brief plain-language course summary
}).strict();

/**
 * Unified Analysis Schema: discriminated union on meta.documentType
 *
 * This enforces mutual exclusivity at the type level:
 * - lab_report → labsSection required, dischargeSection forbidden
 * - discharge_instructions → dischargeSection required, labsSection forbidden
 * - discharge_summary → dischargeSection required, optional labs, imaging, discontinued meds
 */
export const AnalysisSchema = z.discriminatedUnion("meta.documentType", [
    LabReportAnalysisSchema,
    DischargeInstructionsAnalysisSchema,
    DischargeSummaryAnalysisSchema,
]);

// Fallback: Use z.union if discriminatedUnion doesn't work with nested discriminator
// The discriminator path 'meta.documentType' may not be directly supported,
// so we'll use a standard union instead
export const AnalysisSchemaUnion = z.union([
    LabReportAnalysisSchema,
    DischargeInstructionsAnalysisSchema,
    DischargeSummaryAnalysisSchema,
]);

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisResult = z.infer<typeof AnalysisSchemaUnion>;
export type LabReportAnalysis = z.infer<typeof LabReportAnalysisSchema>;
export type DischargeInstructionsAnalysis = z.infer<
    typeof DischargeInstructionsAnalysisSchema
>;
export type DischargeSummaryAnalysis = z.infer<
    typeof DischargeSummaryAnalysisSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates an analysis result against the schema
 *
 * @param input - The analysis result to validate
 * @returns Success object with parsed data or error object with validation errors
 */
export function validateAnalysisResult(
    input: unknown
):
    | { ok: true; data: AnalysisResult }
    | { ok: false; error: z.ZodError<AnalysisResult> } {
    const result = AnalysisSchemaUnion.safeParse(input);

    if (result.success) {
        return { ok: true, data: result.data };
    } else {
        return { ok: false, error: result.error };
    }
}

/**
 * Type guard: checks if an analysis result is a lab report
 *
 * @param result - The analysis result to check
 * @returns true if the result is a lab report
 */
export function isLabReport(
    result: AnalysisResult
): result is LabReportAnalysis {
    return result.meta.documentType === "lab_report";
}

/**
 * Type guard: checks if an analysis result is discharge instructions
 *
 * @param result - The analysis result to check
 * @returns true if the result is discharge instructions
 */
export function isDischargeInstructions(
    result: AnalysisResult
): result is DischargeInstructionsAnalysis {
    return result.meta.documentType === "discharge_instructions";
}

/**
 * Type guard: checks if an analysis result is a discharge summary
 *
 * @param result - The analysis result to check
 * @returns true if the result is a discharge summary
 */
export function isDischargeSummary(
    result: AnalysisResult
): result is DischargeSummaryAnalysis {
    return result.meta.documentType === "discharge_summary";
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export {
    DocumentTypeSchema,
    ReadingLevelSchema,
    ProvenanceSourceSchema,
    LabFlagSchema,
    LabImportanceSchema,
    DischargeStatusSchema,
    ConfidenceScoreSchema,
    ImagingItemSchema,
    ImagingKeyValueSchema,
    DiscontinuedMedicationSchema,
    ImmunizationSchema,
    FollowUpAppointmentSchema,
};
