// src/lib/observability/logger.ts

// ─────────────────────────────────────────────────────────────────────────────
// Types & Enums
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error";

export type AnalyzeEventName =
    | "analyze.started"
    | "analyze.completed"
    | "analyze.failed"
    | "analyze.rate_limited"
    | "analyze.safety_blocked"
    | "analyze.truncated";

export interface LogEvent {
    eventName: AnalyzeEventName | string;
    requestId?: string;
    route?: string;

    documentType?: string;
    readingLevel?: string;

    extractedTextLength?: number;
    previewLength?: number;

    durations?: Record<string, number>;

    errorCategory?: string;
    errorCode?: string;

    truncated?: boolean;

    // allow arbitrary metadata
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety & Sanitization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keys that must NEVER be logged to avoid PHI leaks.
 * This is intentionally broad.
 */
const BLOCKED_KEYS = [
    "text",
    "extractedText",
    "redactedText",
    "raw",
    "content",
    "prompt",
    "response",
    "pdf",
    "file",
    "buffer",
] as const;

const MAX_DEPTH = 6;

/**
 * Safely JSON-stringify without crashing on circular structures.
 */
function safeStringify(obj: unknown): string {
    const seen = new WeakSet<object>();
    return JSON.stringify(obj, (_key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value as object)) return "[CIRCULAR]";
            seen.add(value as object);
        }
        if (typeof value === "bigint") return value.toString();
        return value;
    });
}

/**
 * Recursively sanitizes an object to remove blocked keys and ensure JSON safety.
 */
function sanitizePayload(data: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) return "[DEPTH_LIMIT]";
    if (data === null || data === undefined) return data;

    const t = typeof data;
    if (t === "string" || t === "number" || t === "boolean") return data;
    if (t !== "object") return String(data);

    // Arrays
    if (Array.isArray(data)) {
        return data.map((item) => sanitizePayload(item, depth + 1));
    }

    // Errors
    if (data instanceof Error) {
        // "Production-grade" suggestion: never log stack by default
        return {
            name: data.name,
            message: data.message,
            // stack: process.env.NODE_ENV === "development" ? data.stack : undefined,
            cause: data.cause ? sanitizePayload(data.cause, depth + 1) : undefined,
        };
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        const isBlocked = BLOCKED_KEYS.some((blocked) =>
            lowerKey.includes(blocked.toLowerCase())
        );

        if (isBlocked) {
            sanitized[key] = "[REDACTED]";
            continue;
        }

        sanitized[key] = sanitizePayload(value, depth + 1);
    }

    return sanitized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logger Implementation
// ─────────────────────────────────────────────────────────────────────────────

function log(level: LogLevel, event: LogEvent) {
    const safePayload = sanitizePayload(event) as Record<string, unknown>;

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        ...safePayload,
    };

    const jsonString = safeStringify(entry);

    if (level === "error") console.error(jsonString);
    else if (level === "warn") console.warn(jsonString);
    else console.log(jsonString);
}

export const logger = {
    info: (event: LogEvent) => log("info", event),
    warn: (event: LogEvent) => log("warn", event),
    error: (event: LogEvent) => log("error", event),
};