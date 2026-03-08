// src/app/history/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    loadFullHistory,
    loadLabHistory,
    type HistoryEntry,
    type LabTimeline,
} from "@/lib/persistence/analysisStorage";
import { LabSparkline } from "@/components/LabSparkline";

function parseReferenceRange(
    refRange: string | null
): { low: number; high: number } | undefined {
    if (!refRange) return undefined;
    const match = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (!match) return undefined;
    const low = parseFloat(match[1]);
    const high = parseFloat(match[2]);
    if (isNaN(low) || isNaN(high)) return undefined;
    return { low, high };
}

export default function HistoryPage() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [timelines, setTimelines] = useState<LabTimeline[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [hist, labs] = await Promise.all([
                loadFullHistory(),
                loadLabHistory(),
            ]);
            setHistory(hist);
            setTimelines(labs);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <main className="max-w-6xl mx-auto p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-48 bg-gray-100 rounded-xl" />
                    <div className="h-48 bg-gray-100 rounded-xl" />
                </div>
            </main>
        );
    }

    const topTimelines = timelines.filter((t) => t.points.length >= 2).slice(0, 8);

    return (
        <main className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[13px] font-bold uppercase tracking-wider text-sage mb-1">
                        Analysis History
                    </p>
                    <h1 className="text-3xl font-serif text-navy leading-tight">
                        Your Lab Trends
                    </h1>
                </div>
                <Link
                    href="/results"
                    className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-white transition-colors"
                >
                    ← Latest Results
                </Link>
            </div>

            {/* Lab Trends Section */}
            {topTimelines.length > 0 && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-6">
                        📊 Lab Trends Over Time
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {topTimelines.map((timeline) => {
                            const numericPoints = timeline.points
                                .map((p) => ({
                                    date: p.date,
                                    value: parseFloat(p.value),
                                }))
                                .filter((p) => !isNaN(p.value));

                            if (numericPoints.length < 2) return null;

                            const latest = timeline.points[timeline.points.length - 1];
                            const refRange = parseReferenceRange(null); // Could be extended

                            return (
                                <div
                                    key={timeline.labName}
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                                >
                                    <div className="text-[13px] font-semibold text-navy capitalize mb-1">
                                        {timeline.labName}
                                    </div>
                                    <div className="text-[11px] text-gray-400 mb-3">
                                        {numericPoints.length} readings •{" "}
                                        {latest.unit ?? ""}
                                    </div>
                                    <LabSparkline
                                        points={numericPoints}
                                        referenceRange={refRange}
                                        width={180}
                                        height={48}
                                    />
                                    <div className="mt-2 flex items-center gap-2">
                                        <span
                                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${latest.flag === "high"
                                                    ? "bg-red-100 text-red-700"
                                                    : latest.flag === "low"
                                                        ? "bg-yellow-100 text-yellow-700"
                                                        : "bg-green-100 text-green-700"
                                                }`}
                                        >
                                            {latest.flag?.toUpperCase() ?? "—"}
                                        </span>
                                        <span className="text-[12px] text-gray-600">
                                            Latest: {latest.value}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Empty state for trends */}
            {topTimelines.length === 0 && (
                <section className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-lg font-serif text-navy mb-2">
                        No Trends Yet
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                        Upload multiple lab reports over time to see your results
                        trended here with interactive sparkline charts.
                    </p>
                    <Link
                        href="/upload"
                        className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-light transition-colors"
                    >
                        Upload a Lab Report
                    </Link>
                </section>
            )}

            {/* Upload History */}
            <section>
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                    📋 Upload History ({history.length} documents)
                </h2>

                {history.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                        <p className="text-sm text-gray-500">
                            No analysis history found. Upload a document to get
                            started.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map((entry, idx) => {
                            const docLabel =
                                entry.documentType
                                    ?.replace(/_/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase()) ??
                                "Document";
                            const date = new Date(entry.createdAt);
                            const dateStr = date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            });
                            const timeStr = date.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                            });

                            const labCount =
                                (entry.result as any)?.labsSection?.labs
                                    ?.length ?? 0;
                            const medCount =
                                (entry.result as any)?.dischargeSection
                                    ?.medications?.length ?? 0;

                            return (
                                <Link
                                    key={idx}
                                    href={`/results?entry=${idx}`}
                                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-navy/30 transition-all group"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-sand text-navy flex items-center justify-center text-lg">
                                            {entry.documentType === "lab_report"
                                                ? "🧪"
                                                : "📋"}
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-navy group-hover:text-navy-light transition-colors">
                                                {docLabel}
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                {dateStr} at {timeStr}
                                            </div>
                                        </div>
                                    </div>

                                    {entry.extractionPreview && (
                                        <p className="text-[12px] text-gray-500 line-clamp-2 mb-3">
                                            {entry.extractionPreview.slice(
                                                0,
                                                120
                                            )}
                                            ...
                                        </p>
                                    )}

                                    <div className="flex gap-3 text-[11px] text-gray-400">
                                        {labCount > 0 && (
                                            <span>🧪 {labCount} labs</span>
                                        )}
                                        {medCount > 0 && (
                                            <span>💊 {medCount} meds</span>
                                        )}
                                        <span className="capitalize">
                                            {entry.readingLevel}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Back to home */}
            <div className="text-center pb-8">
                <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
                    Back to Home
                </Link>
            </div>
        </main>
    );
}
