// tests/compliance.test.ts
import assert from "node:assert/strict";
import {
    auditRedaction,
    getAuditStateForTests,
    resetAuditForTests,
} from "../src/lib/compliance/audit";

(function testAuditRedactionTracksEvents() {
    resetAuditForTests();

    auditRedaction("preview_generation", 123);
    auditRedaction("preview_generation", 200);

    const state = getAuditStateForTests();

    assert.ok(state.totalEvents >= 2, "Expected audit to record events");

    // auditRedaction logs a compliance event with metadata containing textLength + timestamp.
    // We'll verify at least one event is of type 'redaction_applied' and includes the context in the message.
    const hasRedactionEvent = state.events.some(
        (e: any) =>
            e.eventType === "redaction_applied" &&
            typeof e.message === "string" &&
            e.message.includes("preview_generation")
    );

    assert.ok(hasRedactionEvent, "Expected redaction_applied event for preview_generation");
})();

console.log("All compliance tests passed! ✓");