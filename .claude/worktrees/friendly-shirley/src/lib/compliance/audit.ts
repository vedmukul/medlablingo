/**
 * Development-only audit logging for compliance monitoring.
 * CRITICAL: Never log PHI/PII content, only metadata and event types.
 */

const isDev = process.env.NODE_ENV === "development";

/**
 * Event types for compliance audit trail.
 */
export type ComplianceEventType =
    | "phi_risk_detected"
    | "data_retention_expired"
    | "data_cleared"
    | "unsafe_content_filtered"
    | "redaction_applied"
    | "storage_migration";

/**
 * In-memory audit state (NO PHI).
 * This is metadata-only and exists primarily for developer observability + tests.
 */
type AuditEvent = {
    level: "info" | "warn";
    eventType: ComplianceEventType;
    message: string;
    metadata?: Record<string, unknown>;
    at: string;
};

let totalEvents = 0;
const events: AuditEvent[] = [];

function record(level: "info" | "warn", eventType: ComplianceEventType, message: string, metadata?: Record<string, unknown>) {
    totalEvents += 1;
    events.push({
        level,
        eventType,
        message,
        metadata,
        at: new Date().toISOString(),
    });

    // Keep memory bounded
    if (events.length > 200) events.splice(0, events.length - 200);
}

/**
 * Log a compliance-related warning in development mode.
 * NEVER include actual PHI/PII content in the message.
 */
export function auditWarn(
    eventType: ComplianceEventType,
    message: string,
    metadata?: Record<string, unknown>
): void {
    record("warn", eventType, message, metadata);

    if (!isDev) return;
    console.warn(`[COMPLIANCE AUDIT] [${eventType}] ${message}`, metadata || {});
}

/**
 * Log a compliance event in development mode.
 * Use this for non-warning audit events (info-level).
 */
export function auditComplianceEvent(
    eventType: ComplianceEventType,
    message: string,
    metadata?: Record<string, unknown>
): void {
    record("info", eventType, message, metadata);

    if (!isDev) return;
    console.info(`[COMPLIANCE AUDIT] [${eventType}] ${message}`, metadata || {});
}

/**
 * Log when redaction is applied to text.
 * Does NOT log the actual text content.
 */
export function auditRedaction(context: string, textLength: number): void {
    auditComplianceEvent("redaction_applied", `Text redacted in ${context}`, {
        textLength,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Log when unsafe content is filtered.
 * Does NOT log the actual unsafe content.
 */
export function auditSafetyFilter(context: string, filteredCount: number): void {
    if (filteredCount > 0) {
        auditWarn("unsafe_content_filtered", `Filtered ${filteredCount} unsafe items in ${context}`, {
            timestamp: new Date().toISOString(),
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test-only helpers (no PHI). Safe to ship, but not used in production.
// ─────────────────────────────────────────────────────────────────────────────

export function getAuditStateForTests() {
    return {
        totalEvents,
        events: [...events],
    };
}

export function resetAuditForTests() {
    totalEvents = 0;
    events.length = 0;
}