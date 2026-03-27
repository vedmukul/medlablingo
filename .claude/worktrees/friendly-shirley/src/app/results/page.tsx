// src/app/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { SummaryCard } from "@/components/SummaryCard";
import { AnalysisChat } from "@/components/AnalysisChat";
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
                    <h1 className="text-heading font-semibold text-text-primary">Analysis Results</h1>

                    <div className="flex gap-4 text-sm">
                        <Link href="/clinician/review" className="text-accent hover:text-accent-dark">
                            Clinician review →
                        </Link>
                        <Link href="/upload" className="text-accent hover:text-accent-dark">
                            ← Upload again
                        </Link>
                    </div>
                </div>

                <DisclaimerBanner />

                <section className="border border-status-critical/30 rounded-card p-4 bg-status-critical-bg">
                    <h2 className="font-medium mb-2 text-status-critical">Could not load results</h2>
                    <p className="text-sm text-status-critical">{error}</p>
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={() => {
                                clearAnalysis();
                                location.href = "/upload";
                            }}
                            className="px-3 py-2 rounded-card bg-status-critical text-text-inverse text-sm"
                        >
                            Clear & Retry
                        </button>
                        <Link href="/upload" className="px-3 py-2 rounded-card border border-accent-muted text-sm text-text-primary">
                            Go to Upload
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    if (!data) {
        return <p className="p-6 text-text-secondary">Loading...</p>;
    }

    const { documentType, readingLevel, extractedTextLength, extractionPreview, result } = data as any;

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-heading font-semibold text-text-primary">Analysis Results</h1>

                <div className="flex gap-4 text-sm items-center">
                    <button
                        onClick={() => window.open('/results/print', '_blank')}
                        className="px-4 py-2 bg-accent text-text-inverse rounded-card hover:bg-accent-dark font-medium transition-colors shadow-card"
                    >
                        Export PDF
                    </button>
                    <Link href="/clinician/review" className="text-accent hover:text-accent-dark">
                        Clinician review →
                    </Link>
                    <button
                        onClick={() => {
                            clearAnalysis();
                            location.reload();
                        }}
                        className="text-text-muted hover:text-text-primary"
                    >
                        Clear saved
                    </button>
                    <Link href="/upload" className="text-accent hover:text-accent-dark">
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
            <section className="border border-accent-muted rounded-card p-4 bg-surface-card shadow-card">
                <h2 className="font-medium mb-1 text-text-primary">Extracted Text Preview</h2>
                <p className="text-sm text-text-secondary mb-2">First ~300 characters of the document.</p>
                <pre className="bg-surface p-3 rounded-card text-sm whitespace-pre-wrap text-text-primary">
                    {extractionPreview || "No preview available."}
                </pre>
            </section>

            {/* AI Summary */}
            {
                result && (
                    <>
                        <section className="border border-accent-muted rounded-card p-4 bg-surface-card shadow-card">
                            <h2 className="font-medium mb-2 text-text-primary">What this document says</h2>
                            <p className="text-text-primary">{result.patientSummary?.overallSummary}</p>

                            {!!result.patientSummary?.keyTakeaways?.length && (
                                <ul className="list-disc ml-5 mt-2 text-text-primary">
                                    {result.patientSummary.keyTakeaways.map((k: string, i: number) => (
                                        <li key={i}>{k}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {!!result.questionsForDoctor?.length && (
                            <section className="border border-accent-muted rounded-card p-4 bg-surface-card shadow-card">
                                <h2 className="font-medium mb-2 text-text-primary">Questions to ask your doctor</h2>
                                <ul className="list-decimal ml-5 text-text-primary">
                                    {result.questionsForDoctor.map((q: string, i: number) => (
                                        <li key={i}>{q}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Analysis Chatbot */}
                        <AnalysisChat
                            result={result}
                            suggestedQuestions={result.questionsForDoctor ?? []}
                        />
                    </>
                )
            }

            <div className="text-center">
                <Link href="/" className="text-sm text-text-secondary hover:text-accent">
                    Back to Home
                </Link>
            </div>
        </main >
    );
}
