/**
 * Unit tests for safety modules.
 * Run with: npx tsx tests/safety.test.ts
 */

import assert from "node:assert";
import { redact } from "../src/lib/safety/redact";
import { safetyFilter, hasUnsafeContent, getSafetyDisclaimer } from "../src/lib/safety/safetyFilter";

const DISCLAIMER = getSafetyDisclaimer();

// ============================================================================
// REDACT TESTS
// ============================================================================

console.log("Testing redact()...\n");

// Test: Email redaction
{
    const input = "Contact john.doe@example.com for more info";
    const output = redact(input);
    assert(output.includes("[EMAIL REDACTED]"), "Should redact email addresses");
    assert(!output.includes("john.doe@example.com"), "Email should be removed");
    console.log("✓ Email redaction works");
}

// Test: Phone number redaction (multiple formats)
{
    const formats = [
        "(555) 123-4567",
        "555-123-4567",
        "555.123.4567",
        "5551234567",
    ];

    for (const phone of formats) {
        const output = redact(`Call ${phone} today`);
        assert(
            output.includes("[PHONE REDACTED]"),
            `Should redact phone format: ${phone}`
        );
        assert(!output.includes(phone), `Phone should be removed: ${phone}`);
    }
    console.log("✓ Phone number redaction works (all formats)");
}

// Test: DOB redaction (MM/DD/YYYY format)
{
    const input = "Date of Birth: 01/15/1990";
    const output = redact(input);
    assert(output.includes("[DOB REDACTED]"), "Should redact MM/DD/YYYY DOB");
    assert(!output.includes("01/15/1990"), "DOB should be removed");
    console.log("✓ DOB redaction (MM/DD/YYYY) works");
}

// Test: DOB redaction (YYYY-MM-DD format)
{
    const input = "DOB: 1990-01-15";
    const output = redact(input);
    assert(output.includes("[DOB REDACTED]"), "Should redact YYYY-MM-DD DOB");
    assert(!output.includes("1990-01-15"), "DOB should be removed");
    console.log("✓ DOB redaction (YYYY-MM-DD) works");
}

// Test: MRN/Patient ID redaction
{
    const inputs = [
        "MRN: 12345678",
        "MRN:ABC123",
        "Patient ID: 98765",
        "PatientID: XYZ999",
    ];

    for (const input of inputs) {
        const output = redact(input);
        assert(output.includes("[ID REDACTED]"), `Should redact ID in: ${input}`);
    }
    console.log("✓ MRN/Patient ID redaction works");
}

// Test: SSN redaction
{
    const input = "SSN: 123-45-6789";
    const output = redact(input);
    assert(output.includes("[SSN REDACTED]"), "Should redact SSN");
    assert(!output.includes("123-45-6789"), "SSN should be removed");
    console.log("✓ SSN redaction works");
}

// Test: Address redaction
{
    const addresses = [
        "123 Main Street",
        "456 Oak Ave",
        "789 Elm Road",
        "1000 Park Boulevard",
    ];

    for (const addr of addresses) {
        const output = redact(`Lives at ${addr}`);
        assert(
            output.includes("[ADDRESS REDACTED]"),
            `Should redact address: ${addr}`
        );
    }
    console.log("✓ Address redaction works");
}

// Test: Clinical text preserved
{
    const clinicalText =
        "Hemoglobin A1c: 7.2%, Glucose: 145 mg/dL, WBC: 8.5 x10^9/L";
    const output = redact(clinicalText);
    assert(output === clinicalText, "Clinical values should be preserved");
    console.log("✓ Clinical text preserved");
}

// Test: Empty/null handling
{
    assert(redact("") === "", "Empty string returns empty");
    assert(redact(null as unknown as string) === null, "Null returns null");
    console.log("✓ Edge cases handled");
}

console.log("\n---\n");

// ============================================================================
// SAFETY FILTER TESTS
// ============================================================================

console.log("Testing safetyFilter()...\n");

// Test: Diagnosis claims filtered
{
    const diagnosisPhrases = [
        "You have diabetes",
        "This means you have hypertension",
        "You are diagnosed with cancer",
    ];

    for (const phrase of diagnosisPhrases) {
        const output = safetyFilter(phrase);
        assert(output.includes("[FILTERED]"), `Should filter: "${phrase}"`);
        assert(output.includes(DISCLAIMER), `Should include disclaimer after: "${phrase}"`);
    }
    console.log("✓ Diagnosis claims filtered");
}

// Test: Treatment advice filtered
{
    const treatmentPhrases = [
        "Start taking metformin daily",
        "Stop taking your blood pressure medication",
        "Increase dose to 20mg",
        "You should take aspirin",
    ];

    for (const phrase of treatmentPhrases) {
        const output = safetyFilter(phrase);
        assert(output.includes("[FILTERED]"), `Should filter: "${phrase}"`);
        assert(output.includes(DISCLAIMER), `Should include disclaimer after: "${phrase}"`);
    }
    console.log("✓ Treatment advice filtered");
}

// Test: Medication changes filtered
{
    const medPhrases = [
        "Switch to a different medication",
        "Change your medication immediately",
        "Discontinue the current treatment",
    ];

    for (const phrase of medPhrases) {
        const output = safetyFilter(phrase);
        assert(output.includes("[FILTERED]"), `Should filter: "${phrase}"`);
    }
    console.log("✓ Medication change recommendations filtered");
}

// Test: Nested object filtering
{
    const input = {
        summary: "You have elevated glucose levels",
        sections: [
            {
                title: "Analysis",
                content: "This means you have prediabetes",
            },
        ],
        meta: {
            timestamp: "2024-01-01",
        },
    };

    const output = safetyFilter(input);
    assert(
        (output as any).summary.includes("[FILTERED]"),
        "Top-level string should be filtered"
    );
    assert(
        (output as any).sections[0].content.includes("[FILTERED]"),
        "Nested string should be filtered"
    );
    assert(
        (output as any).meta.safety === DISCLAIMER,
        "Meta.safety should be added"
    );
    console.log("✓ Nested object filtering works");
}

// Test: Array filtering
{
    const input = [
        "Normal result",
        "You have anemia",
        { note: "Start taking iron supplements" },
    ];

    const output = safetyFilter(input);
    assert(output[0] === "Normal result", "Safe text preserved");
    assert((output[1] as string).includes("[FILTERED]"), "Unsafe array item filtered");
    assert(
        ((output[2] as Record<string, string>).note).includes("[FILTERED]"),
        "Nested object in array filtered"
    );
    console.log("✓ Array filtering works");
}

// Test: Safe text preserved
{
    const safeText = "Your hemoglobin level is 14.2 g/dL, which is within normal range.";
    const output = safetyFilter(safeText);
    assert(output === safeText, "Safe educational text should not be modified");
    console.log("✓ Safe text preserved");
}

// Test: hasUnsafeContent helper
{
    assert(hasUnsafeContent("You have diabetes") === true, "Should detect unsafe content");
    assert(hasUnsafeContent("Normal glucose level") === false, "Should pass safe content");
    console.log("✓ hasUnsafeContent helper works");
}

// Test: Primitives pass through
{
    assert(safetyFilter(42) === 42, "Numbers pass through");
    assert(safetyFilter(true) === true, "Booleans pass through");
    assert(safetyFilter(null) === null, "Null passes through");
    assert(safetyFilter(undefined) === undefined, "Undefined passes through");
    console.log("✓ Primitives pass through unchanged");
}

console.log("\n===================================");
console.log("All tests passed! ✓");
console.log("===================================\n");
