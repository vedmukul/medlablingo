"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SummaryCard } from "@/components/SummaryCard";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

export default function ResultsPage() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const raw = localStorage.getItem("analysis");
        if (raw) setData(JSON.parse(raw));
    }, []);

    if (!data) {
        return <p className="p-6">No analysis found.</p>;
    }

    const {
        documentType,
        readingLevel,
        extractedTextLength,
        extractionPreview,
        result,
    } = data;

    const overallSummary = result?.patientSummary?.overallSummary;
    const keyTakeaways: string[] = result?.patientSummary?.keyTakeaways || [];
    const questionsForDoctor: string[] = result?.questionsForDoctor || [];

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Analysis Results</h1>
                <Link href="/upload" className="text-sm text-blue-600">
                    ← Analyze another
                </Link>
            </div>

            <DisclaimerBanner />

            <SummaryCard
                documentType={documentType}
                readingLevel={readingLevel}
                extractedTextLength={extractedTextLength}
            />

            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-1">Extracted Text Preview</h2>
                <p className="text-sm text-gray-500 mb-2">
                    First ~300 characters of the document.
                </p>
                <pre className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                    {extractionPreview || "No preview available."}
                </pre>
            </section>

            {result && (
                <>
                    <section className="border rounded-lg p-4">
                        <h2 className="font-medium mb-2">What this document says</h2>
                        <p>{overallSummary || "Summary unavailable."}</p>

                        {keyTakeaways.length > 0 && (
                            <ul className="list-disc ml-5 mt-2">
                                {keyTakeaways.map((k, i) => (
                                    <li key={i}>{k}</li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {questionsForDoctor.length > 0 && (
                        <section className="border rounded-lg p-4">
                            <h2 className="font-medium mb-2">Questions to ask your doctor</h2>
                            <ul className="list-decimal ml-5">
                                {questionsForDoctor.map((q, i) => (
                                    <li key={i}>{q}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}

            <div className="text-center">
                <Link href="/" className="text-sm text-gray-600">
                    Back to Home
                </Link>
            </div>
        </main>
    );
}
