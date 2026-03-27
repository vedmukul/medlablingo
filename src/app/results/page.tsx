// src/app/results/page.tsx
"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { AnalysisChat } from "@/components/AnalysisChat";
import { TranslateButton } from "@/components/TranslateButton";
import { DischargeSummaryLayout } from "@/components/results/DischargeSummaryLayout";
import { TrustSafetyIntegrationsPanel } from "@/components/results/TrustSafetyIntegrationsPanel";
import { CareNavigationPanel } from "@/components/results/CareNavigationPanel";
import { MedicationReconciliationSection } from "@/components/results/MedicationReconciliationSection";
import { RedFlagQuiz } from "@/components/results/RedFlagQuiz";
import { SummaryConfidenceChips } from "@/components/results/SummaryConfidenceChips";
import { FeedbackBar } from "@/components/results/FeedbackBar";
import { LabsTable } from "@/components/LabsTable";
import { clearAnalysis, loadAnalysis, loadHistory } from "@/lib/persistence/analysisStorage";
import { isDischargeSummary } from "@/contracts/analysisSchema";
import {
    Apple,
    BarChart3,
    CalendarDays,
    Camera,
    ClipboardList,
    EllipsisVertical,
    FlaskConical,
    Home,
    MessageCircleQuestion,
    Pill,
    Syringe,
} from "lucide-react";

const navIconCls = "w-4 h-4 shrink-0 text-gray-400 group-hover:text-navy motion-safe:transition-colors";

export default function ResultsPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-warmBase flex items-center justify-center p-6">
                <div className="text-gray-400 text-sm">Loading your results...</div>
            </main>
        }>
            <ResultsContent />
        </Suspense>
    );
}

function ResultsContent() {
    const [data, setData] = useState<ReturnType<typeof loadAnalysis>>(null);
    const [error, setError] = useState<string | null>(null);
    const [translated, setTranslated] = useState<Record<string, any> | null>(null);
    const [activeLang, setActiveLang] = useState<string | null>(null);
    const [activeLangLabel, setActiveLangLabel] = useState<string | null>(null);
    const [chatOpen, setChatOpen] = useState(false);

    const searchParams = useSearchParams();

    useEffect(() => {
        try {
            const entryParam = searchParams.get("entry");
            if (entryParam !== null) {
                const idx = parseInt(entryParam);
                const history = loadHistory();
                if (!isNaN(idx) && history[idx]) {
                    setData({
                        ok: true,
                        documentType: history[idx].documentType,
                        readingLevel: history[idx].readingLevel,
                        extractedTextLength: history[idx].extractedTextLength,
                        extractionPreview: history[idx].extractionPreview,
                        result: history[idx].result,
                        requestId: history[idx].requestId,
                    });
                    return;
                }
            }

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
    }, [searchParams]);

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

    // ── Error state ──
    if (error) {
        return (
            <main className="min-h-screen bg-warmBase flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-amber-light text-amber flex items-center justify-center mx-auto text-xl">!</div>
                    <h1 className="text-xl font-semibold text-navy">Could not load results</h1>
                    <p className="text-[14px] text-gray-500">{error}</p>
                    <div className="flex gap-3 justify-center pt-2">
                        <button
                            onClick={() => { clearAnalysis(); location.href = "/upload"; }}
                            className="px-4 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-light transition-colors"
                        >
                            Upload a Document
                        </button>
                        <Link href="/" className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    // ── Loading state ──
    if (!data) {
        return (
            <main className="min-h-screen bg-warmBase flex items-center justify-center p-6">
                <div className="text-gray-400 text-sm">Loading your results...</div>
            </main>
        );
    }

    const { documentType, readingLevel, extractionPreview, result, extractedTextLength, requestId } = data as any;

    const t = translated;
    const summary = t?.overallSummary ?? result?.patientSummary?.overallSummary;
    const takeawaysRaw: string[] = t?.keyTakeaways ?? result?.patientSummary?.keyTakeaways ?? [];
    const questionsRaw: string[] = t?.questionsForDoctor ?? result?.questionsForDoctor ?? [];

    const takeaways = Array.from(new Set(takeawaysRaw));
    const questions = Array.from(new Set(questionsRaw));

    // Sidebar navigation data
    const ds = result?.dischargeSection;
    const warningCount = [...(ds?.warningSignsFromDoc ?? []), ...(ds?.generalRedFlags ?? [])].length;
    const medCount = ds?.medications?.length ?? 0;
    const apptCount = ds?.followUpStructured?.length ?? (ds?.followUp?.length ?? 0);
    const urgentAppts = (ds?.followUpStructured ?? []).filter((a: any) => a.urgency === 'critical').length;
    const taskCount = ds?.dailyMonitoring?.length ?? 0;
    const labCount = result?.labsSection?.labs?.length ?? 0;
    const imagingCount = result?.imagingAndProcedures?.length ?? 0;
    const vaccineCount = result?.immunizations?.length ?? 0;

    return (
        <div className="min-h-screen bg-warmBase">
            {/* ── Top Bar ── */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
                    <Link href="/" className="font-serif text-navy text-lg font-bold tracking-tight">
                        MedLabLingo
                    </Link>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => window.open('/results/print', '_blank')}
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-semibold hover:bg-navy-light motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        Export PDF
                    </button>
                    {result && (
                        <TranslateButton
                            result={result}
                            onTranslated={handleTranslated}
                            onReset={handleResetLang}
                            activeLanguage={activeLang}
                        />
                    )}
                    <details className="relative z-40">
                        <summary className="list-none min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                            <span className="sr-only">More actions</span>
                            <EllipsisVertical className="w-5 h-5" aria-hidden strokeWidth={1.75} />
                        </summary>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-2 w-52 z-50">
                            <Link href="/clinician/review" className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 motion-safe:transition-colors min-h-[44px]">
                                Clinician View
                            </Link>
                            <Link href="/history" className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 motion-safe:transition-colors min-h-[44px]">
                                <BarChart3 className="w-4 h-4 shrink-0 text-gray-400" aria-hidden strokeWidth={1.75} />
                                History &amp; trends
                            </Link>
                            <Link href="/upload" className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 motion-safe:transition-colors min-h-[44px]">
                                Upload new
                            </Link>
                            <hr className="my-1 border-gray-100" />
                            <button
                                type="button"
                                onClick={() => { clearAnalysis(); location.reload(); }}
                                className="block w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 motion-safe:transition-colors min-h-[44px]"
                            >
                                Clear data
                            </button>
                        </div>
                    </details>
                </div>
            </header>

            {/* Translation banner */}
            {activeLangLabel && (
                <div className="max-w-7xl mx-auto px-6 pt-3">
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-[13px] text-indigo-700">
                        <span>Translated to <strong>{activeLangLabel}</strong></span>
                        <button onClick={handleResetLang} className="ml-auto text-indigo-600 hover:text-indigo-800 font-semibold text-[12px]">
                            Show English
                        </button>
                    </div>
                </div>
            )}

            {/* ── Main Layout ── */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex flex-col lg:flex-row items-start gap-10">

                    {/* ── Sidebar ── */}
                    {isDischargeSummary(result) && (
                        <nav className="sticky top-16 z-20 w-full lg:w-52 shrink-0 bg-white lg:bg-transparent rounded-xl lg:rounded-none border lg:border-0 border-gray-100 shadow-sm lg:shadow-none overflow-x-auto lg:overflow-visible">
                            <div className="flex lg:flex-col gap-1 p-2 lg:p-0 text-[13px] font-medium text-gray-500">

                                {/* ESSENTIALS */}
                                <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-gray-300 px-3 pt-1 pb-2">Essentials</span>
                                <a href="#summary" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                    Summary
                                </a>
                                <a href="#trust-safety" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                    Safety &amp; handoff
                                </a>
                                {result?.careNavigation && (
                                    <a href="#care-navigation" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        Care navigation
                                    </a>
                                )}
                                {(result?.medicationReconciliation?.length ?? 0) > 0 && (
                                    <a href="#med-reconciliation" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        Med reconciliation
                                    </a>
                                )}
                                <a href="#quick-safety-check" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                    Quick safety check
                                </a>
                                {warningCount > 0 && (
                                    <a href="#warning-signs" className="px-3 py-2 rounded-lg hover:bg-amber-light/40 hover:text-amber motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40 focus-visible:ring-inset">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />
                                        Warning Signs
                                    </a>
                                )}
                                {medCount > 0 && (
                                    <a href="#medications" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <Pill className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Medications
                                    </a>
                                )}

                                {/* DAILY CARE */}
                                <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-gray-300 px-3 pt-4 pb-2">Daily Care</span>
                                {taskCount > 0 && (
                                    <a href="#monitoring" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <ClipboardList className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Daily tasks
                                    </a>
                                )}
                                {apptCount > 0 && (
                                    <a href="#appointments" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <CalendarDays className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Appointments
                                        {urgentAppts > 0 && <span className="w-1.5 h-1.5 rounded-full bg-customRed flex-shrink-0" aria-hidden />}
                                    </a>
                                )}
                                {(ds?.dietInstructions || ds?.activityRestrictions) && (
                                    <a href="#diet-activity" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <Apple className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Diet &amp; activity
                                    </a>
                                )}
                                {(ds?.homeCareSteps?.length ?? 0) > 0 && (
                                    <a href="#home-care" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <Home className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Home care
                                    </a>
                                )}

                                {/* RECORDS */}
                                <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-gray-300 px-3 pt-4 pb-2">Records</span>
                                {labCount > 0 && (
                                    <a href="#labs" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <FlaskConical className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Labs
                                    </a>
                                )}
                                {imagingCount > 0 && (
                                    <a href="#imaging" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <Camera className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Imaging
                                    </a>
                                )}
                                {vaccineCount > 0 && (
                                    <a href="#vaccines" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <Syringe className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Vaccines
                                    </a>
                                )}
                                {questions.length > 0 && (
                                    <a href="#questions" className="group px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-navy motion-safe:transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-inset">
                                        <MessageCircleQuestion className={navIconCls} strokeWidth={1.75} aria-hidden />
                                        Doctor questions
                                    </a>
                                )}

                                {/* Utility footer — desktop only */}
                                <div className="hidden lg:block mt-6 pt-4 border-t border-gray-100 space-y-3">
                                    <DisclaimerBanner />
                                    <details className="group">
                                        <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-500 transition-colors flex items-center gap-1">
                                            Extracted Text
                                            <span className="group-open:rotate-180 transition-transform">▾</span>
                                        </summary>
                                        <pre className="mt-2 bg-gray-50 p-2.5 rounded text-[10px] whitespace-pre-wrap text-gray-400 border border-gray-100 font-mono max-h-32 overflow-auto">
                                            {extractionPreview || "No preview."}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        </nav>
                    )}

                    {/* ── Main Content ── */}
                    <div className="flex-1 w-full max-w-3xl space-y-8">

                        {/* Document header */}
                        <div>
                            <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                                {documentType.replace('_', ' ')}
                            </p>
                            <h1 className="text-[28px] font-serif text-navy mb-1 leading-tight">
                                Your Results, Explained
                            </h1>
                            <p className="text-[13px] text-gray-400">
                                {readingLevel} reading level
                            </p>
                        </div>

                        {result && !isDischargeSummary(result) && (
                            <nav className="flex flex-wrap gap-2 text-[12px] font-medium text-gray-500 mb-2">
                                <a href="#summary" className="hover:text-navy">Summary</a>
                                <span className="text-gray-200">·</span>
                                <a href="#trust-safety" className="hover:text-navy">Safety &amp; handoff</a>
                                {result.careNavigation && (
                                    <>
                                        <span className="text-gray-200">·</span>
                                        <a href="#care-navigation" className="hover:text-navy">Care navigation</a>
                                    </>
                                )}
                                {(result.medicationReconciliation?.length ?? 0) > 0 && (
                                    <>
                                        <span className="text-gray-200">·</span>
                                        <a href="#med-reconciliation" className="hover:text-navy">Meds</a>
                                    </>
                                )}
                                <span className="text-gray-200">·</span>
                                <a href="#quick-safety-check" className="hover:text-navy">Quick check</a>
                            </nav>
                        )}

                        {/* ══ TIER 1: Always visible ══ */}

                        {/* Summary — hero section */}
                        {result && (
                            <section id="summary" className="bg-white rounded-2xl p-7 space-y-5">
                                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Summary</h2>
                                <SummaryConfidenceChips
                                    overallSummaryConfidence={result.patientSummary?.overallSummaryConfidence}
                                    keyTakeawaysConfidence={result.patientSummary?.keyTakeawaysConfidence}
                                    takeawaysCount={takeaways.length}
                                />
                                <p className="text-[16px] leading-[1.7] text-gray-700 mt-3">{summary}</p>

                                {takeaways.length > 0 && (
                                    <ul className="space-y-2.5 pt-2">
                                        {takeaways.map((k: string, i: number) => (
                                            <li key={i} className="flex gap-3 items-start text-[14px] text-gray-600">
                                                <span className="w-1.5 h-1.5 rounded-full bg-sage mt-2 flex-shrink-0" />
                                                <span className="leading-relaxed">{k}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )}

                        {result?.careNavigation && (
                            <CareNavigationPanel careNavigation={result.careNavigation} />
                        )}

                        {result?.medicationReconciliation && result.medicationReconciliation.length > 0 && (
                            <MedicationReconciliationSection items={result.medicationReconciliation} />
                        )}

                        {result && (
                            <section id="trust-safety" className="scroll-mt-24">
                                <TrustSafetyIntegrationsPanel result={result} extractedTextLength={extractedTextLength} />
                            </section>
                        )}

                        <RedFlagQuiz />

                        {result && (
                            <FeedbackBar requestId={requestId} schemaVersion={result.meta?.schemaVersion} />
                        )}

                        {/* Questions mini-card — floated near top */}
                        {questions.length > 0 && (
                            <a href="#questions" className="block bg-white rounded-xl px-5 py-4 hover:shadow-sm transition-shadow group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-teal-light text-teal flex items-center justify-center text-sm font-bold flex-shrink-0">
                                        {questions.length}
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[14px] font-semibold text-navy">Questions prepared for your visit</span>
                                        <p className="text-[12px] text-gray-400 mt-0.5">AI-generated questions to discuss with your doctor</p>
                                    </div>
                                    <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-lg">→</span>
                                </div>
                            </a>
                        )}

                        {/* ══ Discharge sections (Tiers 2 & 3 via DischargeSummaryLayout) ══ */}
                        {isDischargeSummary(result) && result.dischargeSection && (
                            <div id="warning-signs" className="scroll-mt-24">
                                <DischargeSummaryLayout result={result} t={t} />
                            </div>
                        )}

                        {/* Questions full section */}
                        {questions.length > 0 && (
                            <section id="questions" className="bg-white rounded-2xl p-7 scroll-mt-24 space-y-4">
                                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Questions for your doctor</h2>
                                <div className="space-y-2.5">
                                    {questions.map((q: string, i: number) => (
                                        <div key={i} className="flex gap-3 items-start bg-warmBase rounded-lg px-4 py-3">
                                            <span className="text-teal font-bold text-[14px] mt-0.5">{i + 1}.</span>
                                            <span className="text-[14px] text-gray-700 leading-relaxed">{q}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Labs for non-discharge docs */}
                        {result?.labsSection?.labs?.length > 0 && !isDischargeSummary(result) && (
                            <section id="labs" className="bg-white rounded-2xl p-7 scroll-mt-24 space-y-4">
                                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Key Findings</h2>
                                <LabsTable
                                    labs={result.labsSection.labs}
                                    overallNote={t?.overallLabNote ?? result.labsSection.overallLabNote}
                                    translatedLabs={t?.labExplanations}
                                />
                            </section>
                        )}

                        {/* Legacy discharge fallback */}
                        {result?.dischargeSection && documentType !== "discharge_summary" && (
                            <section className="bg-white rounded-2xl p-7 space-y-4">
                                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Discharge Details</h2>
                                {(t?.medications ?? result.dischargeSection.medications)?.length > 0 && (
                                    <div className="space-y-3">
                                        {(t?.medications ?? result.dischargeSection.medications).map((m: any, i: number) => (
                                            <div key={i} className="bg-warmBase rounded-lg p-4 border-l-[3px] border-teal">
                                                <span className="font-semibold text-navy text-[15px]">{m.name}</span>
                                                <p className="text-[14px] text-gray-600 mt-1">{m.purposePlain}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="text-center pb-8 pt-4">
                            <Link href="/" className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Chat: Overlay drawer ── */}
            {result && (
                <>
                    {/* Floating trigger */}
                    {!chatOpen && (
                        <button
                            onClick={() => setChatOpen(true)}
                            className="fixed bottom-6 right-6 z-30 px-5 py-3 rounded-full bg-navy text-white text-[14px] font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2.5"
                            aria-label="Ask about your results"
                        >
                            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-[13px]">💬</span>
                            Ask about your results
                        </button>
                    )}

                    {/* Backdrop */}
                    {chatOpen && (
                        <div
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                            onClick={() => setChatOpen(false)}
                        />
                    )}

                    {/* Chat panel — slides over, doesn't push content */}
                    <aside className={`fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-white border-l border-gray-100 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${chatOpen ? "translate-x-0" : "translate-x-full"}`}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="text-[15px] font-semibold text-navy">Questions about your results</h2>
                            <button
                                onClick={() => setChatOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                                aria-label="Close chat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                </svg>
                            </button>
                        </div>
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