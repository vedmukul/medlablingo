// tests/persistence.test.ts — analysis storage (Vitest)

import { describe, expect, it, beforeEach } from "vitest";
import type { AnalysisApiResponse, HistoryEntry } from "../src/lib/persistence/analysisStorage";
import {
    saveAnalysis,
    loadLatestAnalysis,
    loadHistory,
    clearAnalysis,
} from "../src/lib/persistence/analysisStorage";

function createMockAnalysis(docType: "lab_report" | "discharge_instructions", index: number): AnalysisApiResponse {
    return {
        ok: true,
        documentType: docType,
        readingLevel: "simple",
        extractedTextLength: 1000 + index,
        extractionPreview: `Preview ${index}`,
        result: {
            documentType: docType,
            readingLevel: "simple",
            summary: `Summary ${index}`,
            ...(docType === "lab_report"
                ? { labsSection: { overview: "Test", findings: [] } }
                : { dischargeSection: { overview: "Test", sections: [] } }),
        } as unknown as AnalysisApiResponse["result"],
        requestId: `req-${index}`,
    };
}

describe("analysisStorage", () => {
    beforeEach(() => {
        clearAnalysis();
        (globalThis.localStorage as Storage).clear();
    });

    it("save and load latest", () => {
        const analysis1 = createMockAnalysis("lab_report", 1);
        saveAnalysis(analysis1);
        const loaded1 = loadLatestAnalysis();
        expect(loaded1).not.toBeNull();
        expect(loaded1?.requestId).toBe("req-1");
        expect(loaded1?.extractedTextLength).toBe(1001);
    });

    it("returns history newest-first", () => {
        saveAnalysis(createMockAnalysis("lab_report", 1));
        saveAnalysis(createMockAnalysis("discharge_instructions", 2));
        saveAnalysis(createMockAnalysis("lab_report", 3));
        const history = loadHistory();
        expect(history).toHaveLength(3);
        expect(history[0].requestId).toBe("req-3");
        expect(history[1].requestId).toBe("req-2");
        expect(history[2].requestId).toBe("req-1");
    });

    it("caps history at 10 entries", () => {
        for (let i = 1; i <= 12; i++) {
            saveAnalysis(createMockAnalysis("lab_report", i));
        }
        const historyLimited = loadHistory();
        expect(historyLimited).toHaveLength(10);
        expect(historyLimited[0].requestId).toBe("req-12");
        expect(historyLimited[9].requestId).toBe("req-3");
        const ids = historyLimited.map((e: HistoryEntry) => e.requestId);
        expect(ids).not.toContain("req-1");
        expect(ids).not.toContain("req-2");
    });

    it("prunes expired entries on read", () => {
        const expiredTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        const validTimestamp = new Date().toISOString();
        const storageData = {
            version: "v2",
            entries: [
                {
                    documentType: "lab_report",
                    readingLevel: "simple",
                    extractedTextLength: 1000,
                    extractionPreview: "Valid",
                    requestId: "req-valid",
                    createdAt: validTimestamp,
                },
                {
                    documentType: "lab_report",
                    readingLevel: "simple",
                    extractedTextLength: 999,
                    extractionPreview: "Expired",
                    requestId: "req-expired",
                    createdAt: expiredTimestamp,
                },
            ],
        };
        localStorage.setItem("lablingo:analysis:v1", JSON.stringify(storageData));
        const historyAfterExpiry = loadHistory();
        expect(historyAfterExpiry).toHaveLength(1);
        expect(historyAfterExpiry[0].requestId).toBe("req-valid");
    });

    it("migrates v1 blob to v2", () => {
        const v1Data = {
            version: "v1",
            savedAt: new Date().toISOString(),
            payload: {
                ok: true,
                documentType: "lab_report",
                readingLevel: "simple",
                extractedTextLength: 1500,
                extractionPreview: "V1 Preview",
                result: {
                    documentType: "lab_report",
                    readingLevel: "simple",
                    summary: "V1 Summary",
                    labsSection: { overview: "Test", findings: [] },
                } as unknown as AnalysisApiResponse["result"],
                requestId: "req-v1",
            },
        };
        localStorage.setItem("lablingo:analysis:v1", JSON.stringify(v1Data));
        const loadedFromV1 = loadLatestAnalysis();
        expect(loadedFromV1).not.toBeNull();
        expect(loadedFromV1?.requestId).toBe("req-v1");
        const rawStorage = localStorage.getItem("lablingo:analysis:v1");
        const parsedStorage = rawStorage ? JSON.parse(rawStorage) : null;
        expect(parsedStorage?.version).toBe("v2");
        expect(Array.isArray(parsedStorage?.entries)).toBe(true);
    });

    it("does not persist extractedText in storage", () => {
        const analysisWithPHI = {
            ...createMockAnalysis("lab_report", 1),
            extractedText: "SENSITIVE PATIENT DATA - SSN: 123-45-6789, Name: John Doe",
        } as AnalysisApiResponse & { extractedText: string };
        saveAnalysis(analysisWithPHI);
        const rawStorageForPHI = localStorage.getItem("lablingo:analysis:v1");
        const storageParsed = rawStorageForPHI ? JSON.parse(rawStorageForPHI) : null;
        const entryHasExtractedText = storageParsed?.entries?.some((e: Record<string, unknown>) =>
            Object.prototype.hasOwnProperty.call(e, "extractedText")
        );
        const hasSensitiveData = JSON.stringify(storageParsed).includes("SENSITIVE PATIENT DATA");
        expect(entryHasExtractedText).toBe(false);
        expect(hasSensitiveData).toBe(false);
        expect(storageParsed?.entries[0]?.extractedTextLength).toBe(1001);
        expect(storageParsed?.entries[0]?.extractionPreview).toBe("Preview 1");
    });

    it("clearAnalysis empties history", () => {
        saveAnalysis(createMockAnalysis("lab_report", 1));
        saveAnalysis(createMockAnalysis("lab_report", 2));
        clearAnalysis();
        expect(loadHistory()).toHaveLength(0);
        expect(loadLatestAnalysis()).toBeNull();
    });
});
