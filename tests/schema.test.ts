/**
 * Schema validation tests (Vitest)
 */

import { describe, expect, it } from "vitest";
import { validateAnalysisResult, isLabReport, isDischargeInstructions } from "../src/contracts/analysisSchema";

describe("analysis schema", () => {
    it("accepts v1.0.0 lab_report without confidence fields", () => {
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
                    emergencyNote: "Call 911 for emergencies",
                },
            },
            patientSummary: {
                overallSummary: "Your labs look good.",
                keyTakeaways: ["Normal results", "No urgent findings", "Follow up in 6 months"],
            },
            questionsForDoctor: [
                "What do these results mean?",
                "Should I change my diet?",
                "Do I need more tests?",
                "When should I follow up?",
                "Are there any concerns?",
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
                        explanation: "Your blood sugar is healthy",
                    },
                ],
            },
            dischargeSection: undefined,
        };

        const oldResult = validateAnalysisResult(oldLabReport);
        expect(oldResult.ok).toBe(true);
        if (oldResult.ok) {
            expect(isLabReport(oldResult.data)).toBe(true);
        }
    });

    it("accepts v1.1.0 discharge_instructions with confidence and structured warning signs", () => {
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
                    emergencyNote: "Call 911 for emergencies",
                },
                modelInfo: {
                    provider: "openai" as const,
                    modelName: "gpt-4",
                    temperature: 0.3,
                },
            },
            patientSummary: {
                overallSummary: "You were discharged after pneumonia treatment.",
                overallSummaryConfidence: 0.95,
                keyTakeaways: ["Complete antibiotics", "Rest for 3-5 days", "Follow up in 1 week"],
                keyTakeawaysConfidence: [0.98, 0.92, 0.97],
            },
            questionsForDoctor: [
                "When can I return to work?",
                "What if symptoms worsen?",
                "Any activity restrictions?",
                "Will I need more tests?",
                "How long will I feel tired?",
            ],
            questionsForDoctorConfidence: [0.88, 0.92, 0.85, 0.9, 0.87],
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
                        cautionsGeneral: "Complete full course. Take with food if upset stomach.",
                    },
                ],
                followUp: ["See Dr. Smith in 1 week"],
                warningSignsFromDoc: [
                    { symptom: "Fever above 101°F", action: "Contact your care team if fever persists or worsens." },
                    { symptom: "Worsening breathing", action: "Seek urgent or emergency care if severe." },
                ],
                generalRedFlags: ["Severe shortness of breath", "Coughing up blood"],
                diagnosesMentionedInDoc: ["Community-acquired pneumonia"],
            },
        };

        const newResult = validateAnalysisResult(newDischargeInstructions);
        expect(newResult.ok).toBe(true);
        if (newResult.ok) {
            expect(isDischargeInstructions(newResult.data)).toBe(true);
        }
    });

    it("accepts partial confidence fields on lab_report", () => {
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
                    emergencyNote: "Call 911 for emergencies",
                },
                modelInfo: {
                    provider: "google" as const,
                    modelName: "gemini-pro",
                    temperature: 0.2,
                },
            },
            patientSummary: {
                overallSummary: "Mixed confidence example",
                overallSummaryConfidence: 0.85,
                keyTakeaways: ["Result 1", "Result 2", "Result 3"],
            },
            questionsForDoctor: ["Q1", "Q2", "Q3", "Q4", "Q5"],
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
                    },
                ],
            },
            dischargeSection: undefined,
        };

        const mixedResult = validateAnalysisResult(mixedLabReport);
        expect(mixedResult.ok).toBe(true);
    });

    it("rejects invalid confidence and array length constraints", () => {
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
                    emergencyNote: "Call 911 for emergencies",
                },
            },
            patientSummary: {
                overallSummary: "Test",
                overallSummaryConfidence: 1.5,
                keyTakeaways: ["Only one"],
            },
            questionsForDoctor: ["Q1"],
            whatWeCouldNotDetermine: [],
            labsSection: { labs: [] },
            dischargeSection: undefined,
        };

        const invalidResult = validateAnalysisResult(invalidData);
        expect(invalidResult.ok).toBe(false);
    });
});
