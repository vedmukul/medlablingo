"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ClipboardCopy,
    ExternalLink,
    FileJson,
    Hash,
    Home,
    Stethoscope,
    Trash2,
    Upload,
} from "lucide-react";
import {
    loadAnalysis,
    clearAnalysis,
    isAnalysisExpired,
    type AnalysisApiResponse,
} from "@/lib/persistence/analysisStorage";

type AnalysisData = AnalysisApiResponse;

function formatClinicianNote(data: AnalysisData): string {
    const docType = (data as any)?.documentType ?? "unknown";
    const reading = (data as any)?.readingLevel ?? "unknown";
    const len = (data as any)?.extractedTextLength ?? 0;

    const r: any = (data as any)?.result ?? {};
    const meta: any = r?.meta ?? {};
    const safety: any = meta?.safety ?? {};
    const patientSummary: any = r?.patientSummary ?? {};
    const questions: string[] = Array.isArray(r?.questionsForDoctor) ? r.questionsForDoctor : [];
    const uncertainties: string[] = Array.isArray(r?.whatWeCouldNotDetermine) ? r.whatWeCouldNotDetermine : [];

    const lines: string[] = [];
    lines.push("MedLabLingo (Educational Assist) — Clinician Review Note");
    lines.push(`DocumentType: ${docType} | ReadingLevel: ${reading} | ExtractedTextLength: ${len}`);
    if ((data as any)?.requestId) lines.push(`RequestId: ${(data as any).requestId}`);
    if (meta?.createdAt) lines.push(`CreatedAt: ${meta.createdAt}`);
    lines.push("");

    if (patientSummary?.overallSummary) {
        lines.push("Patient-facing Summary (model-generated):");
        lines.push(`- ${patientSummary.overallSummary}`);
        const takeaways: string[] = Array.isArray(patientSummary?.keyTakeaways) ? patientSummary.keyTakeaways : [];
        if (takeaways.length) {
            lines.push("Key takeaways:");
            takeaways.forEach((t) => lines.push(`- ${t}`));
        }
        lines.push("");
    }

    if (docType === "lab_report") {
        const labsSection = r?.labsSection ?? {};
        if (labsSection?.overallLabNote) {
            lines.push("Labs Section (model-generated):");
            lines.push(`- ${labsSection.overallLabNote}`);
        }
        const labs = Array.isArray(labsSection?.labs) ? labsSection.labs : [];
        if (labs.length) {
            lines.push("Labs:");
            labs.slice(0, 50).forEach((lab: any) => {
                const name = lab?.name ?? "Unknown";
                const value = lab?.value ?? "";
                const unit = lab?.unit ?? "";
                const flag = lab?.flag ?? "";
                const ref = lab?.referenceRange ?? "";
                lines.push(
                    `- ${name}: ${value}${unit ? " " + unit : ""}${flag ? ` (${flag})` : ""}${ref ? ` | Ref: ${ref}` : ""}`
                );
            });
        } else {
            lines.push("Labs: (none parsed)");
        }
        lines.push("");
    }

    if (docType === "discharge_instructions" || docType === "discharge_summary") {
        const d = r?.dischargeSection ?? {};
        lines.push("Discharge Section (model-generated):");
        if (d?.status) lines.push(`Status: ${d.status}`);
        const homeCare: string[] = Array.isArray(d?.homeCareSteps) ? d.homeCareSteps : [];
        const followUp: string[] = Array.isArray(d?.followUp) ? d.followUp : [];
        const warningSigns: { symptom: string, action: string }[] = Array.isArray(d?.warningSignsFromDoc) ? d.warningSignsFromDoc : [];
        const redFlags: string[] = Array.isArray(d?.generalRedFlags) ? d.generalRedFlags : [];
        if (homeCare.length) {
            lines.push("Home care steps:");
            homeCare.forEach((s) => lines.push(`- ${s}`));
        }
        if (followUp.length) {
            lines.push("Follow-up:");
            followUp.forEach((s) => lines.push(`- ${s}`));
        }
        if (warningSigns.length) {
            lines.push("Warning signs (from doc):");
            warningSigns.forEach((s) => lines.push(`- ${s.symptom} -> ${s.action}`));
        }
        if (redFlags.length) {
            lines.push("General red flags:");
            redFlags.forEach((s) => lines.push(`- ${s}`));
        }
        if (docType === "discharge_summary") {
            const imaging: any[] = Array.isArray(r?.imagingAndProcedures) ? r.imagingAndProcedures : [];
            if (imaging.length) {
                lines.push("Imaging & Procedures:");
                imaging.forEach((i) => lines.push(`- ${i.name}: ${i.findingsPlain || i.findings}`));
            }
        }
        lines.push("");
    }

    if (questions.length) {
        lines.push("Questions for clinician discussion (patient-facing):");
        questions.forEach((q) => lines.push(`- ${q}`));
        lines.push("");
    }

    if (uncertainties.length) {
        lines.push("Uncertainties / not determined:");
        uncertainties.forEach((u) => lines.push(`- ${u}`));
        lines.push("");
    }

    if (safety?.disclaimer) {
        lines.push("Safety disclaimer:");
        lines.push(safety.disclaimer);
    }
    if (safety?.limitations?.length) {
        lines.push("Limitations:");
        safety.limitations.forEach((l: string) => lines.push(`- ${l}`));
    }
    if (safety?.emergencyNote) {
        lines.push("Emergency note:");
        lines.push(safety.emergencyNote);
    }

    return lines.join("\n");
}

async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
}

export default function ClinicianReviewPage() {
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        if (isAnalysisExpired()) {
            clearAnalysis();
            setLoadError("Analysis session expired (24 hour limit). Please upload a new document.");
            return;
        }

        const payload = loadAnalysis();
        if (!payload) {
            setLoadError("No analysis found. Please upload a document.");
            setData(null);
            return;
        }

        setData(payload);
        setLoadError(null);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 1800);
        return () => clearTimeout(t);
    }, [toast]);

    const result: any = (data as any)?.result;
    const docType: any = (data as any)?.documentType;
    const meta: any = result?.meta;
    const safety: any = meta?.safety;

    const clinicianNote = useMemo(() => (data ? formatClinicianNote(data) : ""), [data]);

    const requestId = (data as any)?.requestId;

    const onCopyJSON = async () => {
        if (!data) return;
        await copyToClipboard(JSON.stringify(data, null, 2));
        setToast("Copied full analysis JSON");
    };

    const onCopyNote = async () => {
        if (!data) return;
        await copyToClipboard(clinicianNote);
        setToast("Copied clinician note");
    };

    const onCopyRequestId = async () => {
        if (!requestId) return;
        await copyToClipboard(String(requestId));
        setToast("Copied request ID");
    };

    const onClear = () => {
        clearAnalysis();
        setData(null);
        setLoadError("Cleared stored analysis. Upload a new document.");
    };

    if (loadError) {
        return (
            <main className="min-h-dvh bg-warmBase p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <h1 className="text-2xl font-serif font-bold text-navy flex items-center gap-2">
                            <Stethoscope className="w-7 h-7 text-teal shrink-0" strokeWidth={1.75} aria-hidden />
                            Clinician review
                        </h1>
                        <Link
                            href="/upload"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-teal hover:text-navy motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/35 rounded-lg px-1"
                        >
                            <Upload className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                            Back to upload
                        </Link>
                    </div>

                    <div className="rounded-2xl border border-amber/30 bg-amber-light/50 p-5">
                        <p className="text-sm text-amber-900 leading-relaxed">{loadError}</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-dvh bg-warmBase flex items-center justify-center p-6">
                <p className="text-[15px] text-gray-600">Loading…</p>
            </main>
        );
    }

    const patientSummary: any = result?.patientSummary;
    const keyTakeaways: string[] = Array.isArray(patientSummary?.keyTakeaways) ? patientSummary.keyTakeaways : [];
    const questions: string[] = Array.isArray(result?.questionsForDoctor) ? result.questionsForDoctor : [];
    const notDetermined: string[] = Array.isArray(result?.whatWeCouldNotDetermine) ? result.whatWeCouldNotDetermine : [];

    const labs = Array.isArray(result?.labsSection?.labs) ? result.labsSection.labs : [];
    const discharge = result?.dischargeSection;

    return (
        <main className="min-h-dvh bg-warmBase py-8 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-sage mb-1">Internal review</p>
                    <h1 className="text-2xl sm:text-3xl font-serif font-bold text-navy flex items-center gap-2">
                        <Stethoscope className="w-8 h-8 text-teal shrink-0" strokeWidth={1.75} aria-hidden />
                        Clinician review
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/results"
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold text-navy bg-white border border-gray-200 hover:bg-sand/50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
                    >
                        Patient results
                        <ExternalLink className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
                    </Link>
                    <Link
                        href="/upload"
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold text-teal hover:text-navy motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
                    >
                        <Upload className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                        Upload new
                    </Link>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed bottom-6 right-6 z-50 bg-navy text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm"
                >
                    {toast}
                </div>
            )}

            {/* Safety banner */}
            <section className="rounded-2xl border border-amber/25 bg-amber-light/40 p-5">
                <h2 className="font-semibold text-navy">Educational use only</h2>
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                    For review and triage support. Does not diagnose or recommend treatment. Always verify against the source
                    document.
                </p>
            </section>

            {/* Actions */}
            <section className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onCopyNote}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-navy text-white hover:bg-navy-light motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2"
                >
                    <ClipboardCopy className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                    Copy clinician note
                </button>
                <button
                    type="button"
                    onClick={onCopyJSON}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-navy hover:bg-sand/40 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-offset-2"
                >
                    <FileJson className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                    Copy JSON
                </button>
                {requestId && (
                    <button
                        type="button"
                        onClick={onCopyRequestId}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-navy hover:bg-sand/40 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-offset-2"
                    >
                        <Hash className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                        Copy request ID
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                >
                    <Trash2 className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                    Clear stored analysis
                </button>
            </section>

            {/* Meta */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Metadata</h2>
                <div className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {requestId && (
                        <div>
                            <span className="text-gray-500">Request ID:</span>{" "}
                            <code className="text-xs bg-sand px-2 py-1 rounded-lg text-navy">{String(requestId)}</code>
                        </div>
                    )}
                    <div>
                        <span className="text-gray-500">Document type:</span> {(data as any).documentType}
                    </div>
                    <div>
                        <span className="text-gray-500">Reading level:</span> {(data as any).readingLevel}
                    </div>
                    <div>
                        <span className="text-gray-500">Extracted text length:</span> {(data as any).extractedTextLength ?? 0}
                    </div>
                    <div>
                        <span className="text-gray-500">Schema version:</span> {meta?.schemaVersion ?? "unknown"}
                    </div>
                    <div>
                        <span className="text-gray-500">Created at:</span> {meta?.createdAt ?? "unknown"}
                    </div>
                    <div>
                        <span className="text-gray-500">Provenance:</span> {meta?.provenance?.source ?? "unknown"}
                    </div>
                </div>
            </section>

            {/* Extraction preview */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Extraction preview</h2>
                <p className="text-sm text-gray-500 mb-3">First ~300 characters (scrubbed preview).</p>
                <pre className="bg-warmBase border border-gray-100 p-3 rounded-lg text-sm whitespace-pre-wrap text-gray-700">
                    {(data as any).extractionPreview || "No preview available."}
                </pre>
            </section>

            {/* Patient summary */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Patient-facing summary</h2>
                <p className="text-sm text-gray-700">{patientSummary?.overallSummary ?? "—"}</p>
                {keyTakeaways.length > 0 && (
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                        {keyTakeaways.map((k, i) => (
                            <li key={i}>{k}</li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Conditional: Lab report */}
            {docType === "lab_report" && (
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Labs</h2>
                    <p className="text-sm text-gray-700">{result?.labsSection?.overallLabNote ?? "—"}</p>

                    {labs.length === 0 ? (
                        <div className="text-sm text-gray-500">No labs parsed (empty array).</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-sand text-navy">
                                    <tr>
                                        <th className="text-left p-2 border">Test</th>
                                        <th className="text-left p-2 border">Value</th>
                                        <th className="text-left p-2 border">Unit</th>
                                        <th className="text-left p-2 border">Ref Range</th>
                                        <th className="text-left p-2 border">Flag</th>
                                        <th className="text-left p-2 border">Importance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {labs.slice(0, 200).map((lab: any, idx: number) => (
                                        <tr key={idx} className="border-t">
                                            <td className="p-2 border">{lab?.name ?? "—"}</td>
                                            <td className="p-2 border">{lab?.value ?? "—"}</td>
                                            <td className="p-2 border">{lab?.unit ?? "—"}</td>
                                            <td className="p-2 border">{lab?.referenceRange ?? "—"}</td>
                                            <td className="p-2 border">{lab?.flag ?? "—"}</td>
                                            <td className="p-2 border">{lab?.importance ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {/* Conditional: Discharge instructions / summary */}
            {(docType === "discharge_instructions" || docType === "discharge_summary") && (
                <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        Discharge details <span className="font-mono text-[10px] normal-case">({docType})</span>
                    </h2>

                    {!discharge ? (
                        <div className="text-sm text-gray-500">No dischargeSection present.</div>
                    ) : (
                        <div className="space-y-3 text-sm text-gray-800">
                            <div>
                                <span className="text-gray-500">Status:</span> {discharge?.status ?? "—"}
                            </div>

                            {Array.isArray(discharge?.homeCareSteps) && discharge.homeCareSteps.length > 0 && (
                                <div>
                                    <div className="font-medium">Home care steps</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.homeCareSteps.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray(discharge?.followUp) && discharge.followUp.length > 0 && (
                                <div>
                                    <div className="font-medium">Follow-up</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.followUp.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray(discharge?.warningSignsFromDoc) && discharge.warningSignsFromDoc.length > 0 && (
                                <div className="p-3 rounded-lg bg-amber-light/50 border border-amber/25">
                                    <div className="font-semibold text-navy">Warning signs (from document)</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.warningSignsFromDoc.map((s: { symptom: string, action: string }, i: number) => (
                                            <li key={i}>
                                                <span className="font-semibold">{s.symptom}</span> {" -> "}
                                                <span>{s.action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray(discharge?.generalRedFlags) && discharge.generalRedFlags.length > 0 && (
                                <div className="p-3 rounded-lg bg-customRed-light border border-customRed/20">
                                    <div className="font-semibold text-customRed">General red flags</div>
                                    <ul className="list-disc ml-5 text-gray-800 mt-1">
                                        {discharge.generalRedFlags.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray((result as any)?.imagingAndProcedures) && (result as any).imagingAndProcedures.length > 0 && (
                                <div className="p-3 rounded-lg bg-teal-light/50 border border-teal/25">
                                    <div className="font-semibold text-navy">Imaging &amp; procedures</div>
                                    <ul className="list-disc ml-5">
                                        {(result as any).imagingAndProcedures.map((s: any, i: number) => (
                                            <li key={i}>{s.name}: {s.findingsPlain || s.findings}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Questions */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Questions (patient-facing)</h2>
                {questions.length === 0 ? (
                    <p className="text-sm text-gray-500">None provided.</p>
                ) : (
                    <ol className="list-decimal ml-5 text-sm text-gray-800">
                        {questions.map((q, i) => (
                            <li key={i}>{q}</li>
                        ))}
                    </ol>
                )}
            </section>

            {/* Uncertainties */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">What we could not determine</h2>
                {notDetermined.length === 0 ? (
                    <p className="text-sm text-gray-500">None.</p>
                ) : (
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                        {notDetermined.map((u, i) => (
                            <li key={i}>{u}</li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Safety */}
            <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Safety information</h2>
                <p className="text-sm text-gray-800">{safety?.disclaimer ?? "—"}</p>

                {Array.isArray(safety?.limitations) && safety.limitations.length > 0 && (
                    <div>
                        <div className="text-sm font-medium text-gray-900">Limitations</div>
                        <ul className="list-disc ml-5 text-sm text-gray-700">
                            {safety.limitations.map((l: string, i: number) => (
                                <li key={i}>{l}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {safety?.emergencyNote && (
                    <div className="p-3 rounded-lg bg-customRed-light border border-customRed/30">
                        <div className="text-sm font-semibold text-customRed">Emergency note</div>
                        <p className="text-sm text-customRed mt-1 leading-relaxed">{safety.emergencyNote}</p>
                    </div>
                )}
            </section>

            <div className="text-center pb-8">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 rounded-lg px-2 py-2"
                >
                    <Home className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                    Back to home
                </Link>
            </div>
            </div>
        </main>
    );
}