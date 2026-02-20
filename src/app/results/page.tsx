// src/app/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { SummaryCard } from "@/components/SummaryCard";
import { clearAnalysis, loadAnalysis } from "@/lib/persistence/analysisStorage";

export default function ResultsPage() {
    const [data, setData] = useState<ReturnType<typeof loadAnalysis>>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const payload = loadAnalysis();
            if (!payload) {
                setError("No analysis found (or it expired). Please upload a document again.");
                return;
            }
            if (!payload.ok) {
                setError(payload.error || "Analysis failed. Please upload again.");
                return;
            }
            setData(payload);
        } catch {
            setError("Saved analysis was corrupted. Please upload again.");
        }
    }, []);

    if (error) {
        return (
            <main className="max-w-3xl mx-auto p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-semibold">Analysis Results</h1>

                    <div className="flex gap-4 text-sm">
                        <Link href="/clinician/review" className="text-blue-600">
                            Clinician review →
                        </Link>
                        <Link href="/upload" className="text-blue-600">
                            ← Upload again
                        </Link>
                    </div>
                </div>

                <DisclaimerBanner />

                <section className="border rounded-lg p-4 bg-red-50">
                    <h2 className="font-medium mb-2 text-red-800">Could not load results</h2>
                    <p className="text-sm text-red-700">{error}</p>
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={() => {
                                clearAnalysis();
                                location.href = "/upload";
                            }}
                            className="px-3 py-2 rounded bg-red-600 text-white text-sm"
                        >
                            Clear & Retry
                        </button>
                        <Link href="/upload" className="px-3 py-2 rounded border text-sm">
                            Go to Upload
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    if (!data) {
        return <p className="p-6">Loading...</p>;
    }

    const { documentType, readingLevel, extractedTextLength, extractionPreview, result } = data as any;

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Analysis Results</h1>

                <div className="flex gap-4 text-sm items-center">
                    <button
                        onClick={() => window.open('/results/print', '_blank')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition-colors"
                    >
                        📄 Export PDF
                    </button>
                    <Link href="/clinician/review" className="text-blue-600 hover:text-blue-800">
                        Clinician review →
                    </Link>
                    <button
                        onClick={() => {
                            clearAnalysis();
                            location.reload();
                        }}
                        className="text-gray-500 hover:text-gray-800"
                    >
                        Clear saved
                    </button>
                    <Link href="/upload" className="text-blue-600 hover:text-blue-800">
                        ← Upload again
                    </Link>
                </div>
            </div>


            <DisclaimerBanner />

            <SummaryCard
                documentType={documentType}
                readingLevel={readingLevel}
                extractedTextLength={extractedTextLength}
            />

            {/* Extracted Text Preview */}
            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-1">Extracted Text Preview</h2>
                <p className="text-sm text-gray-500 mb-2">First ~300 characters of the document.</p>
                <pre className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                    {extractionPreview || "No preview available."}
                </pre>
            </section>

            {/* AI Summary */}
            {
                result && (
                    <>
                        <section className="border rounded-lg p-4">
                            <h2 className="font-medium mb-2">What this document says</h2>
                            <p>{result.patientSummary?.overallSummary}</p>

                            {!!result.patientSummary?.keyTakeaways?.length && (
                                <ul className="list-disc ml-5 mt-2">
                                    {result.patientSummary.keyTakeaways.map((k: string, i: number) => (
                                        <li key={i}>{k}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {!!result.questionsForDoctor?.length && (
                            <section className="border rounded-lg p-4">
                                <h2 className="font-medium mb-2">Questions to ask your doctor</h2>
                                <ul className="list-decimal ml-5">
                                    {result.questionsForDoctor.map((q: string, i: number) => (
                                        <li key={i}>{q}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </>
                )
            }

            <div className="text-center">
                <Link href="/" className="text-sm text-gray-600">
                    Back to Home
                </Link>
            </div>
        </main >
    );
}