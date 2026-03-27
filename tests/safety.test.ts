/**
 * Unit tests for safety modules (Vitest)
 */

import { describe, expect, it } from "vitest";
import { redact } from "../src/lib/safety/redact";
import { safetyFilter, hasUnsafeContent, getSafetyDisclaimer } from "../src/lib/safety/safetyFilter";

const DISCLAIMER = getSafetyDisclaimer();

describe("redact()", () => {
    it("redacts email addresses", () => {
        const input = "Contact john.doe@example.com for more info";
        const output = redact(input);
        expect(output).toContain("[EMAIL REDACTED]");
        expect(output).not.toContain("john.doe@example.com");
    });

    it("redacts common phone formats", () => {
        const formats = ["(555) 123-4567", "555-123-4567", "555.123.4567", "5551234567"];
        for (const phone of formats) {
            const output = redact(`Call ${phone} today`);
            expect(output).toContain("[PHONE REDACTED]");
            expect(output).not.toContain(phone);
        }
    });

    it("redacts DOB variants", () => {
        expect(redact("Date of Birth: 01/15/1990")).toContain("[DOB REDACTED]");
        expect(redact("Date of Birth: 01/15/1990")).not.toContain("01/15/1990");
        expect(redact("DOB: 1990-01-15")).toContain("[DOB REDACTED]");
        expect(redact("DOB: 1990-01-15")).not.toContain("1990-01-15");
    });

    it("redacts MRN / patient IDs", () => {
        for (const input of ["MRN: 12345678", "MRN:ABC123", "Patient ID: 98765", "PatientID: XYZ999"]) {
            expect(redact(input)).toContain("[ID REDACTED]");
        }
    });

    it("redacts SSN", () => {
        const output = redact("SSN: 123-45-6789");
        expect(output).toContain("[SSN REDACTED]");
        expect(output).not.toContain("123-45-6789");
    });

    it("redacts street-style addresses", () => {
        for (const addr of ["123 Main Street", "456 Oak Ave", "789 Elm Road", "1000 Park Boulevard"]) {
            expect(redact(`Lives at ${addr}`)).toContain("[ADDRESS REDACTED]");
        }
    });

    it("preserves clinical values", () => {
        const clinicalText = "Hemoglobin A1c: 7.2%, Glucose: 145 mg/dL, WBC: 8.5 x10^9/L";
        expect(redact(clinicalText)).toBe(clinicalText);
    });

    it("handles empty and null", () => {
        expect(redact("")).toBe("");
        expect(redact(null as unknown as string)).toBeNull();
    });
});

describe("safetyFilter()", () => {
    it("filters diagnosis-style phrases (no inline disclaimer on strings)", () => {
        for (const phrase of [
            "You have diabetes",
            "This means you have hypertension",
            "You are diagnosed with cancer",
        ]) {
            const output = safetyFilter(phrase);
            expect(output).toContain("[FILTERED]");
            expect(output).not.toContain(DISCLAIMER);
        }
    });

    it("filters treatment-style phrases", () => {
        for (const phrase of [
            "Start taking metformin daily",
            "Stop taking your blood pressure medication",
            "Increase dose to 20mg",
            "You should take aspirin",
        ]) {
            const output = safetyFilter(phrase);
            expect(output).toContain("[FILTERED]");
            expect(output).not.toContain(DISCLAIMER);
        }
    });

    it("filters medication change phrases", () => {
        for (const phrase of [
            "Switch to a different medication",
            "Change your medication immediately",
            "Discontinue the current treatment",
        ]) {
            expect(safetyFilter(phrase)).toContain("[FILTERED]");
        }
    });

    it("filters nested structures and can add meta.safety on objects", () => {
        const input = {
            summary: "You have elevated glucose levels",
            sections: [{ title: "Analysis", content: "This means you have prediabetes" }],
            meta: { timestamp: "2024-01-01" },
        };
        const output = safetyFilter(input) as typeof input;
        expect(output.summary).toContain("[FILTERED]");
        expect(output.sections[0].content).toContain("[FILTERED]");
        expect((output.meta as { safety?: string }).safety).toBe(DISCLAIMER);
    });

    it("filters arrays", () => {
        const input = ["Normal result", "You have anemia", { note: "Start taking iron supplements" }];
        const output = safetyFilter(input) as [string, string, { note: string }];
        expect(output[0]).toBe("Normal result");
        expect(output[1]).toContain("[FILTERED]");
        expect(output[2].note).toContain("[FILTERED]");
    });

    it("leaves safe educational text unchanged", () => {
        const safeText = "Your hemoglobin level is 14.2 g/dL, which is within normal range.";
        expect(safetyFilter(safeText)).toBe(safeText);
    });

    it("supports hasUnsafeContent", () => {
        expect(hasUnsafeContent("You have diabetes")).toBe(true);
        expect(hasUnsafeContent("Normal glucose level")).toBe(false);
    });

    it("passes primitives through", () => {
        expect(safetyFilter(42)).toBe(42);
        expect(safetyFilter(true)).toBe(true);
        expect(safetyFilter(null)).toBeNull();
        expect(safetyFilter(undefined)).toBeUndefined();
    });
});
