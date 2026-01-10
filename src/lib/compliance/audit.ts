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
    | "redaction_applied";

/**
 * Log a compliance-related warning in development mode.
 * NEVER include actual PHI/PII content in the message.
 *
 * @param eventType - Type of compliance event
 * @param message - Description of the event (no PHI/PII)
 * @param metadata - Additional context (no PHI/PII)
 *
 * @example
 * auditWarn("phi_risk_detected", "Attempt to store raw extracted text", {
 *   location: "api/analyze",
 *   action: "blocked"
 * });
 */
export function auditWarn(
    eventType: ComplianceEventType,
    message: string,
    metadata?: Record<string, unknown>
): void {
    if (!isDev) return;

    console.warn(`[COMPLIANCE AUDIT] [${eventType}] ${message}`, metadata || {});
}

/**
 * Log a compliance event in development mode.
 * Use this for non-warning audit events (info-level).
 *
 * @param eventType - Type of compliance event
 * @param message - Description of the event (no PHI/PII)
 * @param metadata - Additional context (no PHI/PII)
 *
 * @example
 * auditComplianceEvent("data_cleared", "User cleared stored analysis", {
 *   trigger: "manual_button_click"
 * });
 */
export function auditComplianceEvent(
    eventType: ComplianceEventType,
    message: string,
    metadata?: Record<string, unknown>
): void {
    if (!isDev) return;

    console.info(`[COMPLIANCE AUDIT] [${eventType}] ${message}`, metadata || {});
}

/**
 * Log when redaction is applied to text.
 * Does NOT log the actual text content.
 *
 * @param context - Where redaction occurred
 * @param textLength - Length of text being redacted (for context)
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
 *
 * @param context - Where filtering occurred
 * @param filteredCount - Number of items filtered
 */
export function auditSafetyFilter(context: string, filteredCount: number): void {
    if (filteredCount > 0) {
        auditWarn("unsafe_content_filtered", `Filtered ${filteredCount} unsafe items in ${context}`, {
            timestamp: new Date().toISOString(),
        });
    }
}
