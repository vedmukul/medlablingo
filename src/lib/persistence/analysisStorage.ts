// src/lib/persistence/analysisStorage.ts
import type { AnalysisResult } from "@/contracts/analysisSchema";

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
}

type StoredAnalysis = {
    version: "v1";
    savedAt: string; // ISO
    payload: AnalysisApiResponse;
};

const KEY = "lablingo:analysis:v1";

// Optional TTL (set to null to disable)
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function saveAnalysis(payload: AnalysisApiResponse) {
    const data: StoredAnalysis = {
        version: "v1",
        savedAt: new Date().toISOString(),
        payload,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadAnalysis(): AnalysisApiResponse | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as StoredAnalysis;

        if (!parsed?.payload || parsed.version !== "v1") return null;

        if (TTL_MS) {
            const saved = new Date(parsed.savedAt).getTime();
            if (Number.isFinite(saved) && Date.now() - saved > TTL_MS) {
                localStorage.removeItem(KEY);
                return null;
            }
        }

        return parsed.payload;
    } catch {
        return null;
    }
}

export function clearAnalysis() {
    localStorage.removeItem(KEY);
}