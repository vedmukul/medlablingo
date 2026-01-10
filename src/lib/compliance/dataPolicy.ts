/**
 * Data retention policy for LabLingo.
 * Defines TTL, storage keys, and compliance metadata for educational healthcare document handling.
 */

/**
 * Data retention TTL (Time To Live) in milliseconds.
 * Default: 24 hours. After this period, stored analysis is automatically deleted.
 * Set to null to disable TTL enforcement.
 */
export const DATA_RETENTION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Centralized localStorage key for analysis storage.
 * All storage operations should use this key for consistency.
 */
export const STORAGE_KEY = "lablingo:analysis:v1";

/**
 * Storage version for schema evolution.
 */
export const STORAGE_VERSION = "v1";

/**
 * Policy metadata for documentation and UI display.
 */
export const RETENTION_POLICY = {
    ttlHours: 24,
    ttlMs: DATA_RETENTION_TTL_MS,
    description: "Analysis results are stored locally for 24 hours",
    disclaimer: "Educational use only. Not HIPAA compliant. No sensitive data stored on servers.",
} as const;

/**
 * Check if a timestamp is expired based on current TTL policy.
 * @param savedAt - ISO timestamp string when the data was saved
 * @returns true if the data has expired
 */
export function isExpired(savedAt: string): boolean {
    if (!DATA_RETENTION_TTL_MS) {
        return false; // TTL disabled
    }

    const saved = new Date(savedAt).getTime();
    if (!Number.isFinite(saved)) {
        return true; // Invalid timestamp = expired
    }

    return Date.now() - saved > DATA_RETENTION_TTL_MS;
}

/**
 * Get human-readable retention policy information.
 * Useful for UI display and documentation.
 */
export function getRetentionPolicy() {
    return {
        ...RETENTION_POLICY,
        enabled: DATA_RETENTION_TTL_MS !== null,
        expiresIn: (savedAt: string) => {
            if (!DATA_RETENTION_TTL_MS) return null;
            const saved = new Date(savedAt).getTime();
            const remaining = DATA_RETENTION_TTL_MS - (Date.now() - saved);
            return remaining > 0 ? remaining : 0;
        },
    };
}
