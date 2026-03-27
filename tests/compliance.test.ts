// tests/compliance.test.ts
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { auditRedaction, getAuditStateForTests, resetAuditForTests } from "../src/lib/compliance/audit";

describe("compliance audit", () => {
    it("records redaction events for preview_generation", () => {
        resetAuditForTests();

        auditRedaction("preview_generation", 123);
        auditRedaction("preview_generation", 200);

        const state = getAuditStateForTests();

        assert.ok(state.totalEvents >= 2, "Expected audit to record events");

        const hasRedactionEvent = state.events.some(
            (e: { eventType?: string; message?: string }) =>
                e.eventType === "redaction_applied" &&
                typeof e.message === "string" &&
                e.message.includes("preview_generation")
        );

        assert.ok(hasRedactionEvent, "Expected redaction_applied event for preview_generation");
    });
});
