"use client";

function chip(label: string, variant: "high" | "medium" | "low" | "unknown") {
    const map = {
        high: "bg-sage-light text-sage border-sage/30",
        medium: "bg-amber-light text-amber border-amber/30",
        low: "bg-gray-100 text-gray-600 border-gray-200",
        unknown: "bg-gray-50 text-gray-400 border-gray-100",
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[variant]}`}>
            {label}
        </span>
    );
}

function fromScore(s?: number): "high" | "medium" | "low" | "unknown" {
    if (s == null || Number.isNaN(s)) return "unknown";
    if (s >= 0.75) return "high";
    if (s >= 0.45) return "medium";
    return "low";
}

export function SummaryConfidenceChips({
    overallSummaryConfidence,
    keyTakeawaysConfidence,
    takeawaysCount,
}: {
    overallSummaryConfidence?: number;
    keyTakeawaysConfidence?: (number | undefined)[];
    takeawaysCount: number;
}) {
    const summaryLabel = fromScore(overallSummaryConfidence);
    const kt = keyTakeawaysConfidence?.filter((n): n is number => typeof n === "number") ?? [];
    const avgKT =
        kt.length > 0 ? kt.reduce((a, b) => a + b, 0) / kt.length : undefined;
    const takeawaysLabel =
        kt.length === takeawaysCount && takeawaysCount > 0 ? fromScore(avgKT) : "unknown";

    return (
        <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Confidence</span>
            {chip(`Summary: ${summaryLabel === "unknown" ? "not scored" : summaryLabel}`, summaryLabel)}
            {chip(
                `Takeaways: ${takeawaysLabel === "unknown" ? "not scored" : takeawaysLabel}`,
                takeawaysLabel as "high" | "medium" | "low" | "unknown"
            )}
            <span className="text-[10px] text-gray-400 ml-1">Model-reported; verify against your PDF.</span>
        </div>
    );
}
