"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

    if (docType === "discharge_instructions") {
        const d = r?.dischargeSection ?? {};
        lines.push("Discharge Section (model-generated):");
        if (d?.status) lines.push(`Status: ${d.status}`);
        const homeCare: string[] = Array.isArray(d?.homeCareSteps) ? d.homeCareSteps : [];
        const followUp: string[] = Array.isArray(d?.followUp) ? d.followUp : [];
        const warningSigns: string[] = Array.isArray(d?.warningSignsFromDoc) ? d.warningSignsFromDoc : [];
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
            warningSigns.forEach((s) => lines.push(`- ${s}`));
        }
        if (redFlags.length) {
            lines.push("General red flags:");
            redFlags.forEach((s) => lines.push(`- ${s}`));
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
            <main className="max-w-3xl mx-auto p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-heading font-semibold text-text-primary">Clinician Review</h1>
                    <Link href="/upload" className="text-sm text-accent hover:text-accent-dark">
                        ← Back to upload
                    </Link>
                </div>

                <div className="border border-status-caution/30 rounded-card p-4 bg-status-caution-bg">
                    <p className="text-sm text-status-caution">{loadError}</p>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="max-w-3xl mx-auto p-6">
                <p className="text-sm text-text-secondary">Loading…</p>
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
        <main className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-heading font-semibold text-text-primary">Clinician Review</h1>
                <div className="flex items-center gap-3">
                    <Link href="/results" className="text-sm text-accent hover:text-accent-dark">
                        View patient results →
                    </Link>
                    <Link href="/upload" className="text-sm text-accent hover:text-accent-dark">
                        Upload new →
                    </Link>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-text-primary text-text-inverse text-sm px-4 py-2 rounded-card shadow-card-hover">
                    {toast}
                </div>
            )}

            {/* Safety banner */}
            <section className="border border-status-caution/30 rounded-card p-4 bg-status-caution-bg">
                <h2 className="font-medium text-text-primary">Educational Use Only</h2>
                <p className="text-sm text-status-caution mt-1">
                    This view is for review/triage support. It does not diagnose or recommend treatment. Verify against the source
                    document.
                </p>
            </section>

            {/* Actions */}
            <section className="flex flex-wrap gap-2">
                <button onClick={onCopyNote} className="px-3 py-2 rounded-card border border-accent-muted text-sm hover:bg-surface text-text-primary">
                    Copy clinician note
                </button>
                <button onClick={onCopyJSON} className="px-3 py-2 rounded-card border border-accent-muted text-sm hover:bg-surface text-text-primary">
                    Copy JSON
                </button>
                {requestId && (
                    <button onClick={onCopyRequestId} className="px-3 py-2 rounded-card border border-accent-muted text-sm hover:bg-surface text-text-primary">
                        Copy request ID
                    </button>
                )}
                <button
                    onClick={onClear}
                    className="px-3 py-2 rounded-card border border-status-critical/30 text-sm hover:bg-status-critical-bg text-status-critical"
                >
                    Clear stored analysis
                </button>
            </section>

            {/* Meta */}
            <section className="border border-accent-muted rounded-card p-4 space-y-2 shadow-card">
                <h2 className="font-medium text-text-primary">Metadata</h2>
                <div className="text-sm text-text-secondary grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {requestId && (
                        <div>
                            <span className="text-text-muted">Request ID:</span>{" "}
                            <code className="text-xs bg-surface px-2 py-1 rounded">{String(requestId)}</code>
                        </div>
                    )}
                    <div>
                        <span className="text-text-muted">Document type:</span> {(data as any).documentType}
                    </div>
                    <div>
                        <span className="text-text-muted">Reading level:</span> {(data as any).readingLevel}
                    </div>
                    <div>
                        <span className="text-text-muted">Extracted text length:</span> {(data as any).extractedTextLength ?? 0}
                    </div>
                    <div>
                        <span className="text-text-muted">Schema version:</span> {meta?.schemaVersion ?? "unknown"}
                    </div>
                    <div>
                        <span className="text-text-muted">Created at:</span> {meta?.createdAt ?? "unknown"}
                    </div>
                    <div>
                        <span className="text-text-muted">Provenance:</span> {meta?.provenance?.source ?? "unknown"}
                    </div>
                </div>
            </section>

            {/* Extraction preview */}
            <section className="border border-accent-muted rounded-card p-4 shadow-card">
                <h2 className="font-medium mb-1 text-text-primary">Extraction Preview</h2>
                <p className="text-sm text-text-muted mb-2">First ~300 characters (scrubbed preview).</p>
                <pre className="bg-surface p-3 rounded-card text-sm whitespace-pre-wrap text-text-primary">
                    {(data as any).extractionPreview || "No preview available."}
                </pre>
            </section>

            {/* Patient summary */}
            <section className="border border-accent-muted rounded-card p-4 space-y-2 shadow-card">
                <h2 className="font-medium text-text-primary">Patient-facing summary</h2>
                <p className="text-sm text-text-secondary">{patientSummary?.overallSummary ?? "—"}</p>
                {keyTakeaways.length > 0 && (
                    <ul className="list-disc ml-5 text-sm text-text-secondary">
                        {keyTakeaways.map((k, i) => (
                            <li key={i}>{k}</li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Conditional: Lab report */}
            {docType === "lab_report" && (
                <section className="border border-accent-muted rounded-card p-4 space-y-3 shadow-card">
                    <h2 className="font-medium text-text-primary">Labs</h2>
                    <p className="text-sm text-text-secondary">{result?.labsSection?.overallLabNote ?? "—"}</p>

                    {labs.length === 0 ? (
                        <div className="text-sm text-text-muted">No labs parsed (empty array).</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm border border-accent-muted">
                                <thead className="bg-surface">
                                    <tr>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Test</th>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Value</th>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Unit</th>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Ref Range</th>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Flag</th>
                                        <th className="text-left p-2 border border-accent-muted text-text-primary">Importance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {labs.slice(0, 200).map((lab: any, idx: number) => (
                                        <tr key={idx} className="border-t border-accent-muted">
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.name ?? "—"}</td>
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.value ?? "—"}</td>
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.unit ?? "—"}</td>
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.referenceRange ?? "—"}</td>
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.flag ?? "—"}</td>
                                            <td className="p-2 border border-accent-muted text-text-primary">{lab?.importance ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {/* Conditional: Discharge instructions */}
            {docType === "discharge_instructions" && (
                <section className="border border-accent-muted rounded-card p-4 space-y-3 shadow-card">
                    <h2 className="font-medium text-text-primary">Discharge instructions</h2>

                    {!discharge ? (
                        <div className="text-sm text-text-muted">No dischargeSection present.</div>
                    ) : (
                        <div className="space-y-3 text-sm text-text-primary">
                            <div>
                                <span className="text-text-muted">Status:</span> {discharge?.status ?? "—"}
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
                                <div className="p-3 rounded-card bg-status-caution-bg border border-status-caution/30">
                                    <div className="font-medium text-status-caution">Warning signs (from document)</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.warningSignsFromDoc.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray(discharge?.generalRedFlags) && discharge.generalRedFlags.length > 0 && (
                                <div className="p-3 rounded-card bg-status-critical-bg border border-status-critical/30">
                                    <div className="font-medium text-status-critical">General red flags</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.generalRedFlags.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Questions */}
            <section className="border border-accent-muted rounded-card p-4 shadow-card">
                <h2 className="font-medium mb-2 text-text-primary">Questions (patient-facing)</h2>
                {questions.length === 0 ? (
                    <p className="text-sm text-text-muted">None provided.</p>
                ) : (
                    <ol className="list-decimal ml-5 text-sm text-text-primary">
                        {questions.map((q, i) => (
                            <li key={i}>{q}</li>
                        ))}
                    </ol>
                )}
            </section>

            {/* Uncertainties */}
            <section className="border border-accent-muted rounded-card p-4 shadow-card">
                <h2 className="font-medium mb-2 text-text-primary">What we could not determine</h2>
                {notDetermined.length === 0 ? (
                    <p className="text-sm text-text-muted">None.</p>
                ) : (
                    <ul className="list-disc ml-5 text-sm text-text-secondary">
                        {notDetermined.map((u, i) => (
                            <li key={i}>{u}</li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Safety */}
            <section className="border border-accent-muted rounded-card p-4 space-y-2 shadow-card">
                <h2 className="font-medium text-text-primary">Safety information</h2>
                <p className="text-sm text-text-primary">{safety?.disclaimer ?? "—"}</p>

                {Array.isArray(safety?.limitations) && safety.limitations.length > 0 && (
                    <div>
                        <div className="text-sm font-medium text-text-primary">Limitations</div>
                        <ul className="list-disc ml-5 text-sm text-text-secondary">
                            {safety.limitations.map((l: string, i: number) => (
                                <li key={i}>{l}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {safety?.emergencyNote && (
                    <div className="p-3 rounded-card bg-status-critical-bg border border-status-critical/30">
                        <div className="text-sm font-medium text-status-critical">Emergency note</div>
                        <p className="text-sm text-status-critical mt-1">{safety.emergencyNote}</p>
                    </div>
                )}
            </section>

            <div className="text-center">
                <Link href="/" className="text-sm text-text-secondary hover:text-accent">
                    Back to Home
                </Link>
            </div>
        </main>
    );
}
