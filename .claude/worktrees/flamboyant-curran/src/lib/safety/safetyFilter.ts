/**
 * Safety filter to remove unsafe medical overreach phrases from structured results.
 * Traverses nested objects/arrays and replaces dangerous medical claims.
 */

const SAFETY_DISCLAIMER =
    "This report alone cannot diagnose conditions. Please discuss with a clinician.";

// Patterns that indicate unsafe medical overreach
const UNSAFE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
    // Diagnosis claims
    {
        pattern: /\byou have\b/gi,
        description: "diagnosis claim",
    },
    {
        pattern: /\bthis means you have\b/gi,
        description: "diagnosis claim",
    },
    {
        pattern: /\bdiagnosed with\b/gi,
        description: "diagnosis claim",
    },
    {
        pattern: /\byou are suffering from\b/gi,
        description: "diagnosis claim",
    },
    {
        pattern: /\byou definitely have\b/gi,
        description: "diagnosis claim",
    },

    // Treatment advice
    {
        pattern: /\bstart taking\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\bstop taking\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\bincrease (the )?dose\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\bdecrease (the )?dose\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\btake [\w\s]+ to treat\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\byou should take\b/gi,
        description: "treatment advice",
    },
    {
        pattern: /\byou must take\b/gi,
        description: "treatment advice",
    },

    // Medication change recommendations
    {
        pattern: /\bchange your (medication|medicine)\b/gi,
        description: "medication change",
    },
    {
        pattern: /\bswitch to\b/gi,
        description: "medication change",
    },
    {
        pattern: /\bdiscontinue\b/gi,
        description: "medication change",
    },
    {
        pattern: /\bstop your (medication|medicine)\b/gi,
        description: "medication change",
    },
];

/**
 * Check if a string contains unsafe medical phrases.
 */
function containsUnsafePhrase(text: string): boolean {
    return UNSAFE_PATTERNS.some(({ pattern }) => pattern.test(text));
}

function cleanRedactionArtifacts(text: string): string {
    return text
        .replace(/\[FILTERED\]/gi, '')
        .replace(/\[REDACTED\]/gi, '')
        .replace(/\s{2,}/g, ' ') // collapse double spaces left behind
        .trim();
}

/**
 * Filter unsafe phrases from a string, replacing with safe disclaimer.
 */
function filterString(text: string): string {
    if (!text || typeof text !== "string") {
        return text;
    }

    let result = cleanRedactionArtifacts(text);
    let hasUnsafeContent = false;

    for (const { pattern } of UNSAFE_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(result)) {
            hasUnsafeContent = true;
            // Reset again before replace
            pattern.lastIndex = 0;
            result = result.replace(pattern, "[FILTERED]");
        }
    }

    // We no longer append SAFETY_DISCLAIMER to individual strings to prevent mid-sentence UI breaking.
    // The overarching disclaimer banner handles this requirement.

    return result;
}

/**
 * Recursively traverse and filter unsafe phrases in nested objects/arrays.
 *
 * @param value - Any value to traverse and filter
 * @returns The filtered value with unsafe phrases replaced
 *
 * @example
 * safetyFilter({ summary: "You have diabetes" })
 * // Returns: { summary: "[FILTERED] diabetes This report alone cannot diagnose..." }
 */
export function safetyFilter<T>(value: T): T {
    // Handle null/undefined
    if (value === null || value === undefined) {
        return value;
    }

    // Handle strings
    if (typeof value === "string") {
        return filterString(value) as T;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map((item) => safetyFilter(item)) as T;
    }

    // Handle objects
    if (typeof value === "object") {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            result[key] = safetyFilter(val);
        }

        // Add safety disclaimer field if object has meta.safety or safetyDisclaimer
        if ("meta" in result && typeof result.meta === "object" && result.meta !== null) {
            const meta = result.meta as Record<string, unknown>;
            if (!("safety" in meta)) {
                meta.safety = SAFETY_DISCLAIMER;
            }
        }

        if (!("safetyDisclaimer" in result)) {
            // Only add if this looks like a top-level result object with common fields
            if ("summary" in result || "sections" in result || "findings" in result) {
                result.safetyDisclaimer = SAFETY_DISCLAIMER;
            }
        }

        return result as T;
    }

    // Return primitives as-is
    return value;
}

/**
 * Check if text contains any unsafe medical phrases (for validation).
 */
export function hasUnsafeContent(text: string): boolean {
    return containsUnsafePhrase(text);
}

/**
 * Get the standard safety disclaimer text.
 */
export function getSafetyDisclaimer(): string {
    return SAFETY_DISCLAIMER;
}
