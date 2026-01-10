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

const DocumentTypeSchema = z.enum(["lab_report", "discharge_instructions"]);
const ReadingLevelSchema = z.enum(["simple", "standard"]);
const ProvenanceSourceSchema = z.enum(["pdf_upload", "ehr_fhir", "paste"]);

// ─────────────────────────────────────────────────────────────────────────────
// Meta Section
// ─────────────────────────────────────────────────────────────────────────────

const MetaSchema = z
    .object({
        schemaVersion: z.literal("1.0.0"),
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
    })
    .strict();

// ─────────────────────────────────────────────────────────────────────────────
// Patient Summary Section
// ─────────────────────────────────────────────────────────────────────────────

const PatientSummarySchema = z
    .object({
        overallSummary: z.string(),
        keyTakeaways: z.array(z.string()).min(3).max(7),
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
        explanation: z.string(),
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
    })
    .strict();

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
 * Unified Analysis Schema: discriminated union on meta.documentType
 *
 * This enforces mutual exclusivity at the type level:
 * - lab_report → labsSection required, dischargeSection forbidden
 * - discharge_instructions → dischargeSection required, labsSection forbidden
 */
export const AnalysisSchema = z.discriminatedUnion("meta.documentType", [
    LabReportAnalysisSchema,
    DischargeInstructionsAnalysisSchema,
]);

// Fallback: Use z.union if discriminatedUnion doesn't work with nested discriminator
// The discriminator path 'meta.documentType' may not be directly supported,
// so we'll use a standard union instead
export const AnalysisSchemaUnion = z.union([
    LabReportAnalysisSchema,
    DischargeInstructionsAnalysisSchema,
]);

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisResult = z.infer<typeof AnalysisSchemaUnion>;
export type LabReportAnalysis = z.infer<typeof LabReportAnalysisSchema>;
export type DischargeInstructionsAnalysis = z.infer<
    typeof DischargeInstructionsAnalysisSchema
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
};
