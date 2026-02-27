// src/app/results/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { SummaryCard } from "@/components/SummaryCard";
import { AnalysisChat } from "@/components/AnalysisChat";
import { TranslateButton } from "@/components/TranslateButton";
import { clearAnalysis, loadAnalysis } from "@/lib/persistence/analysisStorage";

export default function ResultsPage() {
    const [data, setData] = useState<ReturnType<typeof loadAnalysis>>(null);
    const [error, setError] = useState<string | null>(null);
    const [translated, setTranslated] = useState<Record<string, any> | null>(null);
    const [activeLang, setActiveLang] = useState<string | null>(null);
    const [activeLangLabel, setActiveLangLabel] = useState<string | null>(null);
    const [chatOpen, setChatOpen] = useState(true);

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

    const handleTranslated = useCallback((t: Record<string, any>, code: string, label: string) => {
        setTranslated(t);
        setActiveLang(code);
        setActiveLangLabel(label);
    }, []);

    const handleResetLang = useCallback(() => {
        setTranslated(null);
        setActiveLang(null);
        setActiveLangLabel(null);
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

    const t = translated;
    const summary = t?.overallSummary ?? result?.patientSummary?.overallSummary;
    const takeawaysRaw: string[] = t?.keyTakeaways ?? result?.patientSummary?.keyTakeaways ?? [];
    const questionsRaw: string[] = t?.questionsForDoctor ?? result?.questionsForDoctor ?? [];

    // De-duplicate lists to combat AI repetition
    const takeaways = Array.from(new Set(takeawaysRaw));
    const questions = Array.from(new Set(questionsRaw));

    return (
        <div className="flex min-h-screen">
            {/* Left: Results */}
            <main className={`flex-1 p-6 space-y-6 transition-all ${chatOpen ? "lg:mr-[380px]" : ""}`}>
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* ── Document Header ── */}
                    <div className="mb-2 mt-4">
                        <p className="text-[13px] font-bold uppercase tracking-wider text-sage mb-2">
                            {documentType.replace('_', ' ')}
                        </p>
                        <h1 className="text-3xl font-serif text-navy mb-3 leading-tight">
                            Your Results, Explained
                        </h1>
                        <div className="flex gap-6 text-sm text-gray-500">
                            <span>Diagnostic Report</span>
                            <span>&middot;</span>
                            <span>{readingLevel} Reading Level</span>
                        </div>
                    </div>

                    {/* ── Actions Bar ── */}
                    <div className="flex flex-wrap gap-3 py-4 border-b border-gray-200">
                        <button
                            onClick={() => window.open('/results/print', '_blank')}
                            className="px-5 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-light transition-colors"
                        >
                            Export PDF
                        </button>
                        <Link
                            href="/clinician/review"
                            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-white bg-transparent transition-colors flex items-center"
                        >
                            Clinician View
                        </Link>
                        <button
                            onClick={() => {
                                clearAnalysis();
                                location.reload();
                            }}
                            className="px-5 py-2.5 rounded-lg border border-transparent text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors"
                        >
                            Clear Data
                        </button>
                        <Link
                            href="/upload"
                            className="px-5 py-2.5 rounded-lg border border-transparent text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors"
                        >
                            Upload New
                        </Link>
                        <div className="ml-auto flex items-center">
                            {result && (
                                <TranslateButton
                                    result={result}
                                    onTranslated={handleTranslated}
                                    onReset={handleResetLang}
                                    activeLanguage={activeLang}
                                />
                            )}
                        </div>
                    </div>

                    {activeLangLabel && (
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-800">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                                <path d="M7.75 2.75a.75.75 0 0 0-1.5 0v1.258a32.987 32.987 0 0 0-3.599.278.75.75 0 1 0 .198 1.487A31.545 31.545 0 0 1 8.7 5.545 19.381 19.381 0 0 1 7.257 9.04a19.418 19.418 0 0 1-1.416-2.13.75.75 0 0 0-1.32.716 20.898 20.898 0 0 0 1.987 2.862 19.474 19.474 0 0 1-3.596 2.852.75.75 0 0 0 .848 1.235 20.964 20.964 0 0 0 3.994-3.19 20.964 20.964 0 0 0 3.09 2.37.75.75 0 1 0 .836-1.245 19.479 19.479 0 0 1-2.748-2.118 20.898 20.898 0 0 0 2.05-3.71.75.75 0 1 0-1.36-.632A19.381 19.381 0 0 1 8.7 7.545V2.75Z" />
                                <path d="M12.75 12a.75.75 0 0 1 .694.468l3.25 7.75a.75.75 0 0 1-1.388.564l-.806-1.92H11.5l-.806 1.92a.75.75 0 0 1-1.388-.564l3.25-7.75A.75.75 0 0 1 12.75 12Zm-1.25 5.112h2.5l-1.25-2.98-1.25 2.98Z" />
                            </svg>
                            <span>Translated to <strong>{activeLangLabel}</strong></span>
                            <button onClick={handleResetLang} className="ml-auto text-indigo-600 hover:text-indigo-800 font-medium">
                                Show English
                            </button>
                        </div>
                    )}

                    <DisclaimerBanner />

                    {/* Extracted Text Preview - Hidden in details by default */}
                    <details className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm mt-4 group">
                        <summary className="font-medium cursor-pointer text-gray-700 list-none flex justify-between items-center">
                            Original Extracted Text
                            <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200 text-xl leading-none">▾</span>
                        </summary>
                        <div className="pt-4 mt-4 border-t border-gray-100">
                            <p className="text-sm text-gray-500 mb-3">Viewing the first ~300 characters of the parsed document for verification.</p>
                            <pre className="bg-sand p-4 rounded-lg text-sm whitespace-pre-wrap text-gray-600 border border-gray-100 font-mono">
                                {extractionPreview || "No preview available."}
                            </pre>
                        </div>
                    </details>

                    {/* AI Summary */}
                    {result && (
                        <>
                            <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm hover:shadow-md transition-shadow">
                                <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4">Summary</h2>
                                <p className="text-[15px] leading-relaxed text-gray-800">{summary}</p>

                                {takeaways.length > 0 && (
                                    <ul className="list-none space-y-2 mt-4 text-[14px] text-gray-600">
                                        {takeaways.map((k: string, i: number) => (
                                            <li key={i} className="flex gap-2 items-start">
                                                <span className="text-sage mt-1">•</span>
                                                <span className="leading-relaxed">{k}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {questions.length > 0 && (
                                <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm hover:shadow-md transition-shadow">
                                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4">Questions for your doctor</h2>
                                    <ul className="list-none space-y-3">
                                        {questions.map((q: string, i: number) => (
                                            <li key={i} className="flex gap-3 items-start bg-sand/30 rounded-lg px-4 py-3 border border-gray-100">
                                                <span className="text-navy font-bold">{i + 1}.</span>
                                                <span className="text-[14px] text-gray-700">{q}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* Labs section */}
                            {(result.labsSection?.labs?.length > 0 || result.labsSection?.overallLabNote) && (
                                <section className="mb-8">
                                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 ml-1">Key Findings</h2>
                                    {(t?.overallLabNote ?? result.labsSection.overallLabNote) && (
                                        <p className="text-[14px] text-gray-600 mb-5 ml-1">
                                            {t?.overallLabNote ?? result.labsSection.overallLabNote}
                                        </p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {result.labsSection.labs.map((lab: any, i: number) => {
                                            const labT = Array.isArray(t?.labExplanations) ? t.labExplanations[i] : null;

                                            // Determine status colors based on flag
                                            let dotColor = "bg-sage";
                                            let labelColor = "text-sage";
                                            let label = "Normal";
                                            if (lab.flag === "high" || lab.flag === "low") {
                                                dotColor = lab.flag === "high" ? "bg-customRed" : "bg-amber";
                                                labelColor = lab.flag === "high" ? "text-customRed" : "text-amber";
                                                label = lab.flag === "high" ? "Above Range" : "Below Range";
                                            }

                                            return (
                                                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-[0_4px_20px_rgba(26,39,68,0.06)] transition-all cursor-default">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="font-medium text-[14px] text-gray-500 leading-tight">{labT?.name ?? lab.name}</span>
                                                        <span className="text-[22px] font-serif text-navy leading-none ml-2">
                                                            {lab.value}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                                        <span className={`text-[12px] font-bold ${labelColor}`}>
                                                            {lab.flag ? lab.flag.replace('_', ' ') : label}
                                                        </span>
                                                        {lab.referenceRange && (
                                                            <span className="text-[12px] text-gray-400 ml-1">Normal: {lab.referenceRange}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[14px] leading-relaxed text-gray-600 pt-3 border-t border-gray-100">{labT?.explanation ?? lab.explanation}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Discharge section */}
                            {result.dischargeSection && (
                                <section className="border rounded-lg p-4 space-y-4">
                                    <h2 className="font-medium">Discharge Details</h2>

                                    {(t?.homeCareSteps ?? result.dischargeSection.homeCareSteps)?.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 mb-1">Home Care</h3>
                                            <ul className="list-disc ml-5 text-sm">
                                                {(t?.homeCareSteps ?? result.dischargeSection.homeCareSteps).map((s: string, i: number) => (
                                                    <li key={i}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(t?.followUp ?? result.dischargeSection.followUp)?.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 mb-1">Follow Up</h3>
                                            <ul className="list-disc ml-5 text-sm">
                                                {(t?.followUp ?? result.dischargeSection.followUp).map((s: string, i: number) => (
                                                    <li key={i}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(t?.warningSignsFromDoc ?? result.dischargeSection.warningSignsFromDoc)?.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-red-700 mb-1">Warning Signs</h3>
                                            <ul className="list-disc ml-5 text-sm text-red-800">
                                                {(t?.warningSignsFromDoc ?? result.dischargeSection.warningSignsFromDoc).map((s: string, i: number) => (
                                                    <li key={i}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(t?.medications ?? result.dischargeSection.medications)?.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 mb-1">Medications</h3>
                                            <div className="space-y-2">
                                                {(t?.medications ?? result.dischargeSection.medications).map((m: any, i: number) => (
                                                    <div key={i} className="bg-gray-50 rounded p-3 text-sm flex flex-col gap-1">
                                                        <span className="font-semibold text-gray-800">{m.name}</span>
                                                        <p className="text-gray-600">{m.purposePlain}</p>
                                                        {(m.howToTakeFromDoc || m.timing) && (
                                                            <div className="text-gray-700 bg-white p-2 mt-1 rounded border border-gray-100">
                                                                {m.timing && <span className="font-medium inline-block mr-2">⏱ {m.timing}</span>}
                                                                <span>{m.howToTakeFromDoc}</span>
                                                            </div>
                                                        )}
                                                        {m.cautionsGeneral && <p className="text-red-700 text-xs mt-1 border-t border-red-100 pt-1">⚠️ {m.cautionsGeneral}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* New Discharge Summary Optional Arrays */}
                                    {(result as any).imagingAndProcedures?.length > 0 && (
                                        <div className="pt-4">
                                            <h3 className="text-sm font-medium text-navy mb-2">Imaging & Procedures</h3>
                                            <div className="space-y-2">
                                                {(result as any).imagingAndProcedures.map((item: any, i: number) => (
                                                    <div key={i} className="bg-white border rounded p-3 text-sm shadow-sm">
                                                        <div className="flex justify-between font-semibold text-navy">
                                                            <span>{item.name}</span>
                                                            {item.date && <span className="text-gray-500 text-xs ml-2 mt-0.5">{item.date}</span>}
                                                        </div>
                                                        <p className="text-gray-700 mt-1">{item.findings}</p>
                                                        {item.keyMeasurements && <p className="text-gray-500 mt-2 border-t pt-1 text-xs">Measurements: {item.keyMeasurements}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(result as any).discontinuedMedications?.length > 0 && (
                                        <div className="pt-4">
                                            <h3 className="text-sm font-medium text-amber-700 mb-2">Stopped Medications</h3>
                                            <div className="space-y-2">
                                                {(result as any).discontinuedMedications.map((item: any, i: number) => (
                                                    <div key={i} className="bg-amber-50 rounded p-3 text-sm border border-amber-200">
                                                        <span className="font-semibold text-amber-900 line-through">{item.name}</span>
                                                        <p className="text-amber-800 mt-1">{item.reason}</p>
                                                        {item.replacedBy && <p className="text-amber-900 text-xs mt-2 border-t border-amber-200 pt-1">Replaced by: <strong>{item.replacedBy}</strong></p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}

                    <div className="text-center pb-8">
                        <Link href="/" className="text-sm text-gray-600">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </main>

            {/* Right: Sticky Chat Sidebar */}
            {result && (
                <>
                    {/* Toggle button — visible when chat is closed */}
                    {!chatOpen && (
                        <button
                            onClick={() => setChatOpen(true)}
                            className="fixed bottom-6 right-6 z-30 px-5 py-3 rounded-xl bg-navy text-white text-[15px] font-medium shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 group"
                            aria-label="Open chat"
                        >
                            <span className="text-lg bg-white/20 rounded-full w-6 h-6 flex items-center justify-center group-hover:bg-white/30 transition-colors">?</span>
                            Questions about your results
                        </button>
                    )}

                    {/* Chat panel */}
                    <aside className={`fixed top-0 right-0 h-screen w-[400px] bg-warmWhite border-l border-gray-200 shadow-2xl z-40 flex flex-col transition-transform duration-300 ${chatOpen ? "translate-x-0" : "translate-x-full"}`}>
                        {/* Close button */}
                        <button
                            onClick={() => setChatOpen(false)}
                            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                            aria-label="Close chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                            </svg>
                        </button>

                        <div className="flex-1 overflow-hidden">
                            <AnalysisChat
                                result={result}
                                suggestedQuestions={result.questionsForDoctor ?? []}
                            />
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}