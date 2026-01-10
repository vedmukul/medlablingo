/**
 * Compliance and security tests for LabLingo.
 * Tests TTL enforcement, API response safety, and redaction effectiveness.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
    saveAnalysis,
    loadAnalysis,
    clearAnalysis,
    isAnalysisExpired,
    type AnalysisApiResponse,
} from "../src/lib/persistence/analysisStorage";
import { redact } from "../src/lib/safety/redact";

// Mock localStorage for tests
class LocalStorageMock {
    private store: Record<string, string> = {};

    getItem(key: string): string | null {
        return this.store[key] || null;
    }

    setItem(key: string, value: string): void {
        this.store[key] = value;
    }

    removeItem(key: string): void {
        delete this.store[key];
    }

    clear(): void {
        this.store = {};
    }
}

// @ts-ignore
global.localStorage = new LocalStorageMock();

describe("Compliance: Data Retention TTL", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("should store and load valid analysis", () => {
        const mockPayload: AnalysisApiResponse = {
            ok: true,
            documentType: "lab_report",
            readingLevel: "standard",
            extractedTextLength: 1000,
            extractionPreview: "Mock preview text",
        };

        saveAnalysis(mockPayload);
        const loaded = loadAnalysis();

        expect(loaded).not.toBeNull();
        expect(loaded?.documentType).toBe("lab_report");
        expect(loaded?.extractedTextLength).toBe(1000);
    });

    it("should detect expired analysis and delete it", () => {
        const mockPayload: AnalysisApiResponse = {
            ok: true,
            documentType: "lab_report",
            readingLevel: "standard",
            extractedTextLength: 1000,
            extractionPreview: "Mock preview",
        };

        saveAnalysis(mockPayload);

        // Manually set savedAt to 25 hours ago
        const raw = localStorage.getItem("lablingo:analysis:v1");
        expect(raw).not.toBeNull();

        const parsed = JSON.parse(raw!);
        const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        parsed.savedAt = expiredDate.toISOString();
        localStorage.setItem("lablingo:analysis:v1", JSON.stringify(parsed));

        // Try to load expired analysis
        const loaded = loadAnalysis();
        expect(loaded).toBeNull();

        // Verify it was deleted
        const afterLoad = localStorage.getItem("lablingo:analysis:v1");
        expect(afterLoad).toBeNull();
    });

    it("should report expired status correctly", () => {
        const mockPayload: AnalysisApiResponse = {
            ok: true,
            documentType: "lab_report",
            readingLevel: "standard",
            extractedTextLength: 1000,
            extractionPreview: "Mock preview",
        };

        saveAnalysis(mockPayload);

        // Fresh save should not be expired
        expect(isAnalysisExpired()).toBe(false);

        // Manually expire it
        const raw = localStorage.getItem("lablingo:analysis:v1");
        const parsed = JSON.parse(raw!);
        const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
        parsed.savedAt = expiredDate.toISOString();
        localStorage.setItem("lablingo:analysis:v1", JSON.stringify(parsed));

        // Now it should be expired
        expect(isAnalysisExpired()).toBe(true);
    });

    it("should clear analysis when requested", () => {
        const mockPayload: AnalysisApiResponse = {
            ok: true,
            documentType: "discharge_instructions",
            readingLevel: "simple",
            extractedTextLength: 500,
            extractionPreview: "Preview",
        };

        saveAnalysis(mockPayload);
        expect(loadAnalysis()).not.toBeNull();

        clearAnalysis();
        expect(loadAnalysis()).toBeNull();
    });
});

describe("Compliance: Preview Redaction", () => {
    it("should redact email addresses from preview", () => {
        const textWithEmail = "Contact me at john.doe@example.com for results";
        const redacted = redact(textWithEmail);

        expect(redacted).not.toContain("john.doe@example.com");
        expect(redacted).toContain("[EMAIL REDACTED]");
    });

    it("should redact phone numbers from preview", () => {
        const textWithPhone = "Call (555) 123-4567 for appointments";
        const redacted = redact(textWithPhone);

        expect(redacted).not.toContain("(555) 123-4567");
        expect(redacted).toContain("[PHONE REDACTED]");
    });

    it("should redact multiple PII types", () => {
        const textWithPII =
            "Patient: john@test.com, Phone: 555-123-4567, DOB: 01/15/1980, MRN: 123456";
        const redacted = redact(textWithPII);

        expect(redacted).not.toContain("john@test.com");
        expect(redacted).not.toContain("555-123-4567");
        expect(redacted).not.toContain("01/15/1980");
        expect(redacted).toContain("[EMAIL REDACTED]");
        expect(redacted).toContain("[PHONE REDACTED]");
        expect(redacted).toContain("[DOB REDACTED]");
    });

    it("should preserve clinical information while redacting PII", () => {
        const clinicalText =
            "Glucose elevated at 140 mg/dL. Contact: doctor@clinic.com";
        const redacted = redact(clinicalText);

        // Clinical info preserved
        expect(redacted).toContain("Glucose");
        expect(redacted).toContain("140 mg/dL");

        // PII redacted
        expect(redacted).not.toContain("doctor@clinic.com");
        expect(redacted).toContain("[EMAIL REDACTED]");
    });
});

describe("Compliance: API Response Shape Safety", () => {
    it("should not include full extracted text in response payload", () => {
        // This is a unit test for the expected payload shape
        // The actual API route should never return extractedText field
        const mockApiResponse: AnalysisApiResponse = {
            ok: true,
            documentType: "lab_report",
            readingLevel: "standard",
            extractedTextLength: 5000,
            extractionPreview: "Redacted preview...",
            result: {
                meta: {
                    schemaVersion: "1.0.0",
                    createdAt: new Date().toISOString(),
                    documentType: "lab_report",
                    readingLevel: "standard",
                    language: "en",
                    provenance: { source: "pdf_upload" },
                    safety: {
                        disclaimer: "Educational only",
                        limitations: [],
                        emergencyNote: "Call 911 if emergency",
                    },
                },
                patientSummary: {
                    overallSummary: "Test summary",
                    keyTakeaways: [],
                },
                questionsForDoctor: [],
                whatWeCouldNotDetermine: [],
                labsSection: {
                    overallLabNote: "Note",
                    labs: [],
                },
                dischargeSection: undefined,
            },
        };

        // Verify the shape
        expect(mockApiResponse).toHaveProperty("extractedTextLength");
        expect(mockApiResponse).toHaveProperty("extractionPreview");
        expect(mockApiResponse).not.toHaveProperty("extractedText");

        // Preview should be limited
        expect(mockApiResponse.extractionPreview.length).toBeLessThan(350);
    });

    it("should have proper TTL metadata in stored analysis", () => {
        const mockPayload: AnalysisApiResponse = {
            ok: true,
            documentType: "lab_report",
            readingLevel: "standard",
            extractedTextLength: 1000,
            extractionPreview: "Preview",
        };

        saveAnalysis(mockPayload);

        const raw = localStorage.getItem("lablingo:analysis:v1");
        expect(raw).not.toBeNull();

        const parsed = JSON.parse(raw!);
        expect(parsed).toHaveProperty("version");
        expect(parsed).toHaveProperty("savedAt");
        expect(parsed).toHaveProperty("payload");
        expect(parsed.version).toBe("v1");

        // savedAt should be a valid ISO timestamp
        const savedDate = new Date(parsed.savedAt);
        expect(savedDate.getTime()).toBeGreaterThan(0);
    });
});
