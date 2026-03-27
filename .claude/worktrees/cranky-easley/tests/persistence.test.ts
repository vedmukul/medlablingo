// tests/persistence.test.ts
// Minimal test suite for multi-entry analysis storage
// Run with: npx tsx tests/persistence.test.ts

import type { AnalysisApiResponse, HistoryEntry } from "../src/lib/persistence/analysisStorage";

// Mock localStorage for Node.js environment
class LocalStorageMock {
    private store: Map<string, string> = new Map();

    getItem(key: string): string | null {
        return this.store.get(key) || null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

global.localStorage = new LocalStorageMock() as any;

// Import after localStorage mock is set up
const { saveAnalysis, loadLatestAnalysis, loadHistory, clearAnalysis } = require("../src/lib/persistence/analysisStorage");

// Test utilities
let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
    testCount++;
    if (condition) {
        passCount++;
        console.log(`✓ ${message}`);
    } else {
        console.error(`✗ ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

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
                : { dischargeSection: { overview: "Test", sections: [] } }
            )
        } as any,
        requestId: `req-${index}`,
    };
}

// Test Suite
console.log("🧪 Running Persistence Storage Tests\n");

// Test 1: Save and Load Latest
console.log("Test 1: Save and Load Latest Analysis");
clearAnalysis();
const analysis1 = createMockAnalysis("lab_report", 1);
saveAnalysis(analysis1);
const loaded1 = loadLatestAnalysis();
assert(loaded1 !== null, "loadLatestAnalysis returns non-null");
assert(loaded1?.requestId === "req-1", "Loaded correct analysis");
assert(loaded1?.extractedTextLength === 1001, "Correct extracted text length");
console.log();

// Test 2: History Retrieval (newest → oldest)
console.log("Test 2: History Retrieval Order");
clearAnalysis();
const analysis2a = createMockAnalysis("lab_report", 1);
const analysis2b = createMockAnalysis("discharge_instructions", 2);
const analysis2c = createMockAnalysis("lab_report", 3);
saveAnalysis(analysis2a);
saveAnalysis(analysis2b);
saveAnalysis(analysis2c);
const history = loadHistory();
assert(history.length === 3, "History contains 3 entries");
assert(history[0].requestId === "req-3", "First entry is newest (req-3)");
assert(history[1].requestId === "req-2", "Second entry is middle (req-2)");
assert(history[2].requestId === "req-1", "Third entry is oldest (req-1)");
console.log();

// Test 3: 10-Entry Limit
console.log("Test 3: Enforce 10-Entry Maximum");
clearAnalysis();
for (let i = 1; i <= 12; i++) {
    saveAnalysis(createMockAnalysis("lab_report", i));
}
const historyLimited = loadHistory();
assert(historyLimited.length === 10, "History limited to 10 entries");
assert(historyLimited[0].requestId === "req-12", "Newest entry retained (req-12)");
assert(historyLimited[9].requestId === "req-3", "10th entry is req-3");
// req-1 and req-2 should be dropped
const hasReq1 = historyLimited.some((e: HistoryEntry) => e.requestId === "req-1");
const hasReq2 = historyLimited.some((e: HistoryEntry) => e.requestId === "req-2");
assert(!hasReq1 && !hasReq2, "Oldest 2 entries (req-1, req-2) were dropped");
console.log();

// Test 4: TTL Expiration (manual timestamp manipulation)
console.log("Test 4: TTL Expiration and Auto-Pruning");
clearAnalysis();
// Manually create expired entry (25 hours ago)
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
        }
    ]
};
localStorage.setItem("lablingo:analysis:v1", JSON.stringify(storageData));
const historyAfterExpiry = loadHistory();
assert(historyAfterExpiry.length === 1, "Expired entry pruned, 1 valid entry remains");
assert(historyAfterExpiry[0].requestId === "req-valid", "Valid entry retained");
console.log();

// Test 5: Backward Compatibility (v1 → v2 migration)
console.log("Test 5: Backward Compatibility (v1 Migration)");
clearAnalysis();
// Manually create v1 format
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
            labsSection: { overview: "Test", findings: [] }
        } as any,
        requestId: "req-v1",
    }
};
localStorage.setItem("lablingo:analysis:v1", JSON.stringify(v1Data));
const loadedFromV1 = loadLatestAnalysis();
assert(loadedFromV1 !== null, "v1 data migrated successfully");
assert(loadedFromV1?.requestId === "req-v1", "v1 data preserved after migration");
// Verify storage was upgraded to v2
const rawStorage = localStorage.getItem("lablingo:analysis:v1");
const parsedStorage = rawStorage ? JSON.parse(rawStorage) : null;
assert(parsedStorage?.version === "v2", "Storage upgraded to v2");
assert(Array.isArray(parsedStorage?.entries), "v2 has entries array");
console.log();

// Test 6: PHI Safety (no extractedText stored)
console.log("Test 6: PHI Safety - No extractedText Stored");
clearAnalysis();
const analysisWithPHI = {
    ...createMockAnalysis("lab_report", 1),
    // Simulate extractedText being present in API response (should NOT be stored)
    extractedText: "SENSITIVE PATIENT DATA - SSN: 123-45-6789, Name: John Doe"
} as any;
saveAnalysis(analysisWithPHI);
const rawStorageForPHI = localStorage.getItem("lablingo:analysis:v1");
const storageParsed = rawStorageForPHI ? JSON.parse(rawStorageForPHI) : null;
// Check entries array for extractedText field
const entryHasExtractedText = storageParsed?.entries?.some((e: any) => 'extractedText' in e);
const hasSensitiveData = JSON.stringify(storageParsed).includes("SENSITIVE PATIENT DATA");
assert(!entryHasExtractedText, "extractedText field not present in storage entries");
assert(!hasSensitiveData, "Sensitive data not stored");
assert(storageParsed?.entries[0]?.extractedTextLength === 1001, "extractedTextLength stored (metadata only)");
assert(storageParsed?.entries[0]?.extractionPreview === "Preview 1", "extractionPreview stored (safe)");
console.log();

// Test 7: Clear All History
console.log("Test 7: Clear All History");
clearAnalysis();
saveAnalysis(createMockAnalysis("lab_report", 1));
saveAnalysis(createMockAnalysis("lab_report", 2));
clearAnalysis();
const historyAfterClear = loadHistory();
const loadedAfterClear = loadLatestAnalysis();
assert(historyAfterClear.length === 0, "History empty after clearAnalysis()");
assert(loadedAfterClear === null, "loadLatestAnalysis returns null after clear");
console.log();

// Summary
console.log("═".repeat(50));
console.log(`✅ All ${passCount}/${testCount} tests passed!\n`);
console.log("Verified:");
console.log("  ✓ Multi-entry storage (up to 10 entries)");
console.log("  ✓ TTL enforcement with auto-pruning");
console.log("  ✓ Backward compatibility (v1 → v2 migration)");
console.log("  ✓ PHI safety (no extractedText stored)");
console.log("  ✓ Correct ordering (newest → oldest)");
console.log("  ✓ Clear functionality");
