"use client";

import { useState } from "react";

export function FeedbackBar({
    requestId,
    schemaVersion,
}: {
    requestId?: string;
    schemaVersion?: string;
}) {
    const [helpful, setHelpful] = useState<boolean | null>(null);
    const [comment, setComment] = useState("");
    const [sent, setSent] = useState<"idle" | "sending" | "ok" | "err">("idle");

    const submit = async () => {
        if (helpful === null) return;
        setSent("sending");
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    helpful,
                    comment: comment.trim() || undefined,
                    requestId,
                    page: "/results",
                    schemaVersion,
                }),
            });
            if (!res.ok) throw new Error("fail");
            setSent("ok");
        } catch {
            setSent("err");
        }
    };

    if (sent === "ok") {
        return (
            <div className="rounded-xl border border-sage/30 bg-sage-light/40 px-4 py-3 text-[13px] text-sage">
                Thanks — your feedback helps us improve. No personal health details were sent.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-4 space-y-3">
            <p className="text-[12px] font-semibold text-gray-600">Was this summary helpful?</p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setHelpful(true)}
                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold border ${helpful === true ? "bg-teal text-white border-teal" : "bg-white border-gray-200 text-gray-700"}`}
                >
                    Yes
                </button>
                <button
                    type="button"
                    onClick={() => setHelpful(false)}
                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold border ${helpful === false ? "bg-navy text-white border-navy" : "bg-white border-gray-200 text-gray-700"}`}
                >
                    Not really
                </button>
            </div>
            <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-800 min-h-[72px]"
                placeholder="Optional: what would make this better? (avoid personal medical details)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
            />
            <button
                type="button"
                disabled={helpful === null || sent === "sending"}
                onClick={submit}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-[13px] font-semibold disabled:opacity-40"
            >
                {sent === "sending" ? "Sending…" : "Send feedback"}
            </button>
            {sent === "err" && <p className="text-[12px] text-customRed">Could not send. Try again later.</p>}
            <p className="text-[10px] text-gray-400">
                Feedback is logged for product improvement. For HIPAA/BAA deployments, route via FEEDBACK_WEBHOOK_URL to your
                compliant pipeline (see OPERATIONS.md).
            </p>
        </div>
    );
}
