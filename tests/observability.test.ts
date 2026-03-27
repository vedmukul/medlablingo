// tests/observability.test.ts
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { logger } from "../src/lib/observability/logger";
import { checkRateLimit, resetRateLimiterForTests } from "../src/lib/observability/rateLimiter";

function captureConsole(fn: () => void) {
    const logs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;

    console.log = (msg?: unknown) => logs.push(String(msg));
    console.warn = (msg?: unknown) => logs.push(String(msg));
    console.error = (msg?: unknown) => logs.push(String(msg));

    try {
        fn();
    } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origErr;
    }
    return logs;
}

describe("observability", () => {
    it("logger redacts blocked keys", () => {
        const logs = captureConsole(() => {
            logger.info({
                eventName: "analyze.started",
                requestId: "req-123",
                extractedText: "SUPER_SENSITIVE",
                prompt: "SUPER_SENSITIVE",
                nested: { redactedText: "SUPER_SENSITIVE" },
            });
        });

        assert.equal(logs.length, 1);

        const parsed = JSON.parse(logs[0]);
        const s = JSON.stringify(parsed);

        assert.ok(s.includes("[REDACTED]"), "Expected logger to redact blocked keys");
        assert.ok(!s.includes("SUPER_SENSITIVE"), "Logger leaked sensitive content");
    });

    it("rate limiter eventually blocks repeated requests", () => {
        resetRateLimiterForTests();

        const ip = "1.2.3.4";
        let blocked = false;

        for (let i = 0; i < 50; i++) {
            const ok = checkRateLimit(ip);
            if (!ok) {
                blocked = true;
                break;
            }
        }

        assert.ok(blocked, "Expected rate limiter to eventually block repeated requests");
    });
});
