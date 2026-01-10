// src/lib/persistence/analysisStorage.ts
import type { AnalysisResult } from "@/contracts/analysisSchema";
import {
    STORAGE_KEY,
    STORAGE_VERSION,
    DATA_RETENTION_TTL_MS,
    isExpired,
} from "@/lib/compliance/dataPolicy";
import { auditComplianceEvent } from "@/lib/compliance/audit";

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

type StoredAnalysis = {
    version: "v1";
    savedAt: string; // ISO
    payload: AnalysisApiResponse;
};

export function saveAnalysis(payload: AnalysisApiResponse) {
    const data: StoredAnalysis = {
        version: STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        payload,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAnalysis(): AnalysisApiResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as StoredAnalysis;

        if (!parsed?.payload || parsed.version !== STORAGE_VERSION) return null;

        // Check TTL expiration
        if (isExpired(parsed.savedAt)) {
            auditComplianceEvent(
                "data_retention_expired",
                "Stored analysis expired and was deleted",
                { savedAt: parsed.savedAt }
            );
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return parsed.payload;
    } catch {
        return null;
    }
}

/**
 * Check if stored analysis has expired without loading it.
 * Useful for UI to show expiration messages.
 */
export function isAnalysisExpired(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
        const parsed = JSON.parse(raw) as StoredAnalysis;
        return isExpired(parsed.savedAt);
    } catch {
        return false;
    }
}

export function clearAnalysis() {
    auditComplianceEvent("data_cleared", "User manually cleared stored analysis");
    localStorage.removeItem(STORAGE_KEY);
}