/**
 * Best-effort PII redaction from text.
 * Conservative approach - removes obvious identifiers while preserving clinical meaning.
 */

// Redaction patterns with their replacement text
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Email addresses
    {
        pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,
        replacement: "[EMAIL REDACTED]",
    },

    // Phone numbers (various US formats)
    // Matches: (555) 123-4567, 555-123-4567, 555.123.4567, 5551234567
    {
        pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        replacement: "[PHONE REDACTED]",
    },

    // DOB pattern: MM/DD/YYYY or M/D/YYYY or MM/DD/YY
    {
        pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
        replacement: "[DOB REDACTED]",
    },

    // DOB pattern: YYYY-MM-DD (ISO format)
    {
        pattern: /\b\d{4}-\d{2}-\d{2}\b/g,
        replacement: "[DOB REDACTED]",
    },

    // MRN and Patient ID with labels
    {
        pattern: /\b(MRN|Patient\s*ID)\s*[:#]?\s*\S+/gi,
        replacement: "[ID REDACTED]",
    },

    // Social Security Numbers
    {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: "[SSN REDACTED]",
    },

    // Simple address heuristic: number followed by street type
    // Matches: 123 Main Street, 456 Oak Ave, etc.
    {
        pattern:
            /\b\d{1,5}\s+[\w\s]{1,30}\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|circle|cir|place|pl)\b\.?/gi,
        replacement: "[ADDRESS REDACTED]",
    },
];

/**
 * Redacts personally identifiable information from text.
 *
 * @param text - The input text to redact
 * @returns Text with PII replaced by redaction markers
 *
 * @example
 * redact("Contact john@email.com or call (555) 123-4567")
 * // Returns: "Contact [EMAIL REDACTED] or call [PHONE REDACTED]"
 */
export function redact(text: string): string {
    if (!text || typeof text !== "string") {
        return text;
    }

    let result = text;

    for (const { pattern, replacement } of REDACTION_PATTERNS) {
        result = result.replace(pattern, replacement);
    }

    return result;
}
