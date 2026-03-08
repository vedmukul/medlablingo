// src/lib/persistence/analysisStorage.ts
import type { AnalysisResult } from "@/contracts/analysisSchema";
import {
    STORAGE_KEY,
    DATA_RETENTION_TTL_MS,
    isExpired,
} from "@/lib/compliance/dataPolicy";
import { auditComplianceEvent } from "@/lib/compliance/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/supabaseClient";
import { getDeviceId } from "@/lib/supabase/deviceId";

export type DocumentType = "lab_report" | "discharge_instructions";
export type ReadingLevel = "simple" | "standard";

export interface AnalysisApiResponse {
    ok: boolean;
    documentType: DocumentType;
    readingLevel: ReadingLevel;
    extractedTextLength: number;
    extractionPreview: string;
    result?: AnalysisResult;
    error?: string;
    hint?: string;
    requestId?: string; // Correlation ID for observability
}

// Legacy v1 format (single entry)
type StoredAnalysisV1 = {
    version: "v1";
    savedAt: string; // ISO
    payload: AnalysisApiResponse;
};

// New v2 format (multi-entry history)
export type HistoryEntry = {
    documentType: DocumentType;
    readingLevel: ReadingLevel;
    extractedTextLength: number;
    extractionPreview: string;
    result?: AnalysisResult;
    requestId?: string;
    createdAt: string; // ISO timestamp
};

type StoredAnalysisHistory = {
    version: "v2";
    entries: HistoryEntry[]; // max 10, newest first
};

const MAX_HISTORY_ENTRIES = 10;
const STORAGE_VERSION_V2 = "v2";

/**
 * Migrate v1 single-entry format to v2 history format.
 */
function migrateFromV1(old: StoredAnalysisV1): StoredAnalysisHistory {
    const entry: HistoryEntry = {
        documentType: old.payload.documentType,
        readingLevel: old.payload.readingLevel,
        extractedTextLength: old.payload.extractedTextLength,
        extractionPreview: old.payload.extractionPreview,
        result: old.payload.result,
        requestId: old.payload.requestId,
        createdAt: old.savedAt,
    };

    auditComplianceEvent(
        "storage_migration",
        "Migrated v1 storage to v2 history format",
        { from: "v1", to: "v2" }
    );

    return {
        version: STORAGE_VERSION_V2,
        entries: [entry],
    };
}

/**
 * Prune expired entries based on 24h TTL.
 */
function pruneExpired(entries: HistoryEntry[]): HistoryEntry[] {
    const validEntries = entries.filter((entry) => !isExpired(entry.createdAt));
    const expiredCount = entries.length - validEntries.length;

    if (expiredCount > 0) {
        auditComplianceEvent(
            "data_retention_expired",
            `${expiredCount} expired entries pruned from history`,
            { expiredCount, remainingCount: validEntries.length }
        );
    }

    return validEntries;
}

/**
 * Load and parse storage, handling migration and format validation.
 */
function loadStorage(): StoredAnalysisHistory | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);

        // Handle v1 → v2 migration
        if (parsed.version === "v1") {
            const migrated = migrateFromV1(parsed as StoredAnalysisV1);
            // Save migrated format
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            return migrated;
        }

        // Validate v2 format
        if (parsed.version === STORAGE_VERSION_V2 && Array.isArray(parsed.entries)) {
            return parsed as StoredAnalysisHistory;
        }

        // Unknown format
        return null;
    } catch {
        return null;
    }
}

/**
 * Save analysis to history. Appends newest entry, enforces 10-entry limit.
 * @param payload - Analysis API response (extractedText is NOT stored)
 */
export function saveAnalysis(payload: AnalysisApiResponse) {
    const storage = loadStorage();
    const existingEntries = storage?.entries || [];

    // Create new entry (PHI-safe: no extractedText)
    const newEntry: HistoryEntry = {
        documentType: payload.documentType,
        readingLevel: payload.readingLevel,
        extractedTextLength: payload.extractedTextLength,
        extractionPreview: payload.extractionPreview,
        result: payload.result,
        requestId: payload.requestId,
        createdAt: new Date().toISOString(),
    };

    // Prepend new entry (newest first), enforce limit
    const updatedEntries = [newEntry, ...existingEntries].slice(0, MAX_HISTORY_ENTRIES);

    const data: StoredAnalysisHistory = {
        version: STORAGE_VERSION_V2,
        entries: updatedEntries,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Dual-write to Supabase (fire-and-forget, non-blocking)
    if (isSupabaseConfigured() && supabase) {
        const deviceId = getDeviceId();
        supabase
            .from("analyses")
            .insert({
                device_id: deviceId,
                document_type: payload.documentType,
                reading_level: payload.readingLevel,
                extraction_preview: payload.extractionPreview,
                result: payload.result as unknown as Record<string, unknown>,
                request_id: payload.requestId,
            })
            .then(({ error }) => {
                if (error) console.warn("[Supabase] Failed to save analysis:", error.message);
            });
    }
}

/**
 * Load latest analysis from history (backward compatible with existing flow).
 * @returns Latest valid analysis or null if none exists or all expired
 */
export function loadLatestAnalysis(): AnalysisApiResponse | null {
    const storage = loadStorage();
    if (!storage?.entries) return null;

    // Prune expired entries
    const validEntries = pruneExpired(storage.entries);

    if (validEntries.length === 0) {
        // All expired, clear storage
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }

    // Update storage if entries were pruned
    if (validEntries.length !== storage.entries.length) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: STORAGE_VERSION_V2, entries: validEntries })
        );
    }

    // Return latest entry as AnalysisApiResponse format
    const latest = validEntries[0];
    return {
        ok: true,
        documentType: latest.documentType,
        readingLevel: latest.readingLevel,
        extractedTextLength: latest.extractedTextLength,
        extractionPreview: latest.extractionPreview,
        result: latest.result,
        requestId: latest.requestId,
    };
}

/**
 * Load analysis history (newest → oldest).
 * @returns Array of valid history entries
 */
export function loadHistory(): HistoryEntry[] {
    const storage = loadStorage();
    if (!storage?.entries) return [];

    // Prune expired entries
    const validEntries = pruneExpired(storage.entries);

    // Update storage if entries were pruned
    if (validEntries.length !== storage.entries.length) {
        if (validEntries.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ version: STORAGE_VERSION_V2, entries: validEntries })
            );
        }
    }

    return validEntries;
}

/**
 * Check if stored analysis has expired without loading it.
 * Useful for UI to show expiration messages.
 * @deprecated - Use loadLatestAnalysis() which handles expiration automatically
 */
export function isAnalysisExpired(): boolean {
    const storage = loadStorage();
    if (!storage?.entries || storage.entries.length === 0) return false;

    // Check if latest entry is expired
    return isExpired(storage.entries[0].createdAt);
}

/**
 * Clear all analysis history.
 */
export function clearAnalysis() {
    auditComplianceEvent("data_cleared", "User manually cleared all stored analysis history");
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Backward compatibility alias (deprecated).
 * @deprecated - Use loadLatestAnalysis() instead
 */
export function loadAnalysis(): AnalysisApiResponse | null {
    return loadLatestAnalysis();
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase-backed history for Multi-Document Timelines
// ─────────────────────────────────────────────────────────────────────────────

export interface LabTimepoint {
    date: string;
    value: string;
    unit: string | null;
    flag: string;
}

export interface LabTimeline {
    labName: string;
    points: LabTimepoint[];
}

/**
 * Load full analysis history from Supabase (falls back to localStorage).
 * No TTL applied — Supabase data persists indefinitely.
 */
export async function loadFullHistory(): Promise<HistoryEntry[]> {
    if (isSupabaseConfigured() && supabase) {
        const deviceId = getDeviceId();
        const { data, error } = await supabase
            .from("analyses")
            .select("*")
            .eq("device_id", deviceId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!error && data && data.length > 0) {
            return data.map((row: any) => ({
                documentType: row.document_type,
                readingLevel: row.reading_level,
                extractedTextLength: 0,
                extractionPreview: row.extraction_preview ?? "",
                result: row.result as AnalysisResult,
                requestId: row.request_id,
                createdAt: row.created_at,
            }));
        }
    }

    // Fallback to localStorage
    return loadHistory();
}

/**
 * Extract lab timelines from history for sparkline charts.
 * Groups lab values across documents by normalized name.
 */
export async function loadLabHistory(): Promise<LabTimeline[]> {
    const entries = await loadFullHistory();
    const labMap = new Map<string, LabTimepoint[]>();

    for (const entry of entries) {
        const labs = (entry.result as any)?.labsSection?.labs;
        if (!Array.isArray(labs)) continue;

        const entryDate = entry.createdAt;

        for (const lab of labs) {
            const key = lab.name?.toLowerCase().trim();
            if (!key) continue;

            const existing = labMap.get(key) ?? [];
            existing.push({
                date: entryDate,
                value: lab.value,
                unit: lab.unit ?? null,
                flag: lab.flag ?? "unknown",
            });
            labMap.set(key, existing);
        }
    }

    // Convert to array, sort each timeline by date (oldest first)
    const timelines: LabTimeline[] = [];
    for (const [labName, points] of labMap) {
        points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        timelines.push({ labName, points });
    }

    // Sort timelines by number of data points (most tracked first)
    timelines.sort((a, b) => b.points.length - a.points.length);

    return timelines;
}