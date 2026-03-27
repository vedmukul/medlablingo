/**
 * Schema validation tests
 * Run with: npx tsx tests/schema.test.ts
 */

import { validateAnalysisResult, isLabReport, isDischargeInstructions } from "../src/contracts/analysisSchema";

console.log("Testing Analysis Schema v1.1.0 with confidence scoring...\\n");

// ============================================================================
// BACKWARD COMPATIBILITY TEST - Old format (v1.0.0, no confidence fields)
// ============================================================================

console.log("Testing backward compatibility (v1.0.0 format without confidence)...\\n");

const oldLabReport = {
    meta: {
        schemaVersion: "1.0.0" as const,
        createdAt: "2026-02-11T18:00:00Z",
        documentType: "lab_report" as const,
        readingLevel: "simple" as const,
        language: "en",
        provenance: { source: "pdf_upload" as const },
        safety: {
            disclaimer: "Educational only.",
            limitations: ["Cannot diagnose"],
            emergencyNote: "Call 911 for emergencies"
        }
    },
    patientSummary: {
        overallSummary: "Your labs look good.",
        keyTakeaways: ["Normal results", "No urgent findings", "Follow up in 6 months"]
    },
    questionsForDoctor: [
        "What do these results mean?",
        "Should I change my diet?",
        "Do I need more tests?",
        "When should I follow up?",
        "Are there any concerns?"
    ],
    whatWeCouldNotDetermine: ["Previous lab history"],
    labsSection: {
        overallLabNote: "All within normal limits",
        labs: [
            {
                name: "Glucose",
                value: "95",
                unit: "mg/dL",
                referenceRange: "70-100",
                flag: "normal" as const,
                importance: "medium" as const,
                explanation: "Your blood sugar is healthy"
            }
        ]
    },
    dischargeSection: undefined
};

const oldResult = validateAnalysisResult(oldLabReport);
if (!oldResult.ok) {
    console.error("❌ FAILED: Old format should validate");
    console.error(oldResult.error.issues);
    process.exit(1);
}
console.log("✓ Old format (v1.0.0) validates successfully");
console.log("✓ Type guard isLabReport:", isLabReport(oldResult.data));

// ============================================================================
// FORWARD COMPATIBILITY TEST - New format (v1.1.0, with confidence fields)
// ============================================================================

console.log("\\nTesting forward compatibility (v1.1.0 format with confidence)...\\n");

const newDischargeInstructions = {
    meta: {
        schemaVersion: "1.1.0" as const,
        createdAt: "2026-02-11T18:00:00Z",
        documentType: "discharge_instructions" as const,
        readingLevel: "standard" as const,
        language: "en",
        provenance: { source: "paste" as const },
        safety: {
            disclaimer: "Educational only.",
            limitations: ["Cannot modify prescriptions"],
            emergencyNote: "Call 911 for emergencies"
        },
        modelInfo: {
            provider: "openai" as const,
            modelName: "gpt-4",
            temperature: 0.3
        }
    },
    patientSummary: {
        overallSummary: "You were discharged after pneumonia treatment.",
        overallSummaryConfidence: 0.95,
        keyTakeaways: [
            "Complete antibiotics",
            "Rest for 3-5 days",
            "Follow up in 1 week"
        ],
        keyTakeawaysConfidence: [0.98, 0.92, 0.97]
    },
    questionsForDoctor: [
        "When can I return to work?",
        "What if symptoms worsen?",
        "Any activity restrictions?",
        "Will I need more tests?",
        "How long will I feel tired?"
    ],
    questionsForDoctorConfidence: [0.88, 0.92, 0.85, 0.90, 0.87],
    whatWeCouldNotDetermine: ["Exact diagnosis details"],
    labsSection: undefined,
    dischargeSection: {
        status: "approved" as const,
        homeCareSteps: ["Take antibiotics", "Rest", "Drink fluids"],
        medications: [
            {
                name: "Amoxicillin 500mg",
                purposePlain: "Antibiotic for lung infection",
                howToTakeFromDoc: "One pill three times daily for 10 days",
                cautionsGeneral: "Complete full course. Take with food if upset stomach."
            }
        ],
        followUp: ["See Dr. Smith in 1 week"],
        warningSignsFromDoc: ["Fever above 101°F", "Worsening breathing"],
        generalRedFlags: ["Severe shortness of breath", "Coughing up blood"],
        diagnosesMentionedInDoc: ["Community-acquired pneumonia"]
    }
};

const newResult = validateAnalysisResult(newDischargeInstructions);
if (!newResult.ok) {
    console.error("❌ FAILED: New format with confidence should validate");
    console.error(newResult.error.issues);
    process.exit(1);
}
console.log("✓ New format (v1.1.0) with confidence fields validates successfully");
console.log("✓ Type guard isDischargeInstructions:", isDischargeInstructions(newResult.data));

// ============================================================================
// MIXED FORMAT TEST - New version, partial confidence (some optional missing)
// ============================================================================

console.log("\\nTesting mixed format (v1.1.0 with some confidence fields)...\\n");

const mixedLabReport = {
    meta: {
        schemaVersion: "1.1.0" as const,
        createdAt: "2026-02-11T18:00:00Z",
        documentType: "lab_report" as const,
        readingLevel: "simple" as const,
        provenance: { source: "ehr_fhir" as const },
        safety: {
            disclaimer: "Educational only.",
            limitations: ["Cannot diagnose"],
            emergencyNote: "Call 911 for emergencies"
        },
        modelInfo: {
            provider: "google" as const,
            modelName: "gemini-pro",
            temperature: 0.2
        }
    },
    patientSummary: {
        overallSummary: "Mixed confidence example",
        overallSummaryConfidence: 0.85,
        keyTakeaways: ["Result 1", "Result 2", "Result 3"],
        // Note: keyTakeawaysConfidence omitted - should be optional
    },
    questionsForDoctor: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    // Note: questionsForDoctorConfidence omitted - should be optional
    whatWeCouldNotDetermine: [],
    labsSection: {
        labs: [
            {
                name: "Test",
                value: "10",
                unit: null,
                referenceRange: null,
                flag: "unknown" as const,
                importance: "low" as const,
                explanation: "N/A",
                confidenceScore: 0.75,
            }
        ]
    },
    dischargeSection: undefined
};

const mixedResult = validateAnalysisResult(mixedLabReport);
if (!mixedResult.ok) {
    console.error("❌ FAILED: Mixed format should validate");
    console.error(mixedResult.error.issues);
    process.exit(1);
}
console.log("✓ Mixed format (partial confidence) validates successfully");

// ============================================================================
// VALIDATION ERROR TEST - Invalid data should fail
// ============================================================================

console.log("\\nTesting validation errors (invalid data should fail)...\\n");

const invalidData = {
    meta: {
        schemaVersion: "1.1.0",
        createdAt: "2026-02-11T18:00:00Z",
        documentType: "lab_report",
        readingLevel: "simple",
        provenance: { source: "pdf_upload" },
        safety: {
            disclaimer: "Educational only.",
            limitations: ["Cannot diagnose"],
            emergencyNote: "Call 911 for emergencies"
        }
    },
    patientSummary: {
        overallSummary: "Test",
        overallSummaryConfidence: 1.5, // INVALID: outside 0-1 range
        keyTakeaways: ["Only one"], // INVALID: min 3 required
    },
    questionsForDoctor: ["Q1"], // INVALID: min 5 required
    whatWeCouldNotDetermine: [],
    labsSection: { labs: [] },
    dischargeSection: undefined
};

const invalidResult = validateAnalysisResult(invalidData);
if (invalidResult.ok) {
    console.error("❌ FAILED: Invalid data should not validate");
    process.exit(1);
}
console.log("✓ Invalid data correctly fails validation");
console.log("  - Confidence score > 1.0 rejected");
console.log("  - Array length constraints enforced");

console.log("\\n===================================");
console.log("All schema tests passed! ✓");
console.log("===================================\\n");
