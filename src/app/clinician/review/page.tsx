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
            <main className="max-w-3xl mx-auto p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-semibold">Clinician Review</h1>
                    <Link href="/upload" className="text-sm text-blue-600">
                        ← Back to upload
                    </Link>
                </div>

                <div className="border rounded-lg p-4 bg-yellow-50">
                    <p className="text-sm text-yellow-900">{loadError}</p>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="max-w-3xl mx-auto p-6">
                <p className="text-sm text-gray-600">Loading…</p>
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
                <h1 className="text-2xl font-semibold">Clinician Review</h1>
                <div className="flex items-center gap-3">
                    <Link href="/results" className="text-sm text-blue-600">
                        View patient results →
                    </Link>
                    <Link href="/upload" className="text-sm text-blue-600">
                        Upload new →
                    </Link>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-black text-white text-sm px-4 py-2 rounded shadow">
                    {toast}
                </div>
            )}

            {/* Safety banner */}
            <section className="border rounded-lg p-4 bg-amber-50">
                <h2 className="font-medium">Educational Use Only</h2>
                <p className="text-sm text-amber-900 mt-1">
                    This view is for review/triage support. It does not diagnose or recommend treatment. Verify against the source
                    document.
                </p>
            </section>

            {/* Actions */}
            <section className="flex flex-wrap gap-2">
                <button onClick={onCopyNote} className="px-3 py-2 rounded border text-sm hover:bg-gray-50">
                    Copy clinician note
                </button>
                <button onClick={onCopyJSON} className="px-3 py-2 rounded border text-sm hover:bg-gray-50">
                    Copy JSON
                </button>
                {requestId && (
                    <button onClick={onCopyRequestId} className="px-3 py-2 rounded border text-sm hover:bg-gray-50">
                        Copy request ID
                    </button>
                )}
                <button
                    onClick={onClear}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50 text-red-600 border-red-200"
                >
                    Clear stored analysis
                </button>
            </section>

            {/* Meta */}
            <section className="border rounded-lg p-4 space-y-2">
                <h2 className="font-medium">Metadata</h2>
                <div className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {requestId && (
                        <div>
                            <span className="text-gray-500">Request ID:</span>{" "}
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{String(requestId)}</code>
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
            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-1">Extraction Preview</h2>
                <p className="text-sm text-gray-500 mb-2">First ~300 characters (scrubbed preview).</p>
                <pre className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                    {(data as any).extractionPreview || "No preview available."}
                </pre>
            </section>

            {/* Patient summary */}
            <section className="border rounded-lg p-4 space-y-2">
                <h2 className="font-medium">Patient-facing summary</h2>
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
                <section className="border rounded-lg p-4 space-y-3">
                    <h2 className="font-medium">Labs</h2>
                    <p className="text-sm text-gray-700">{result?.labsSection?.overallLabNote ?? "—"}</p>

                    {labs.length === 0 ? (
                        <div className="text-sm text-gray-500">No labs parsed (empty array).</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-full text-sm border">
                                <thead className="bg-gray-50">
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
                <section className="border rounded-lg p-4 space-y-3">
                    <h2 className="font-medium">Discharge details ({docType})</h2>

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
                                <div className="p-3 rounded bg-yellow-50 border border-yellow-100">
                                    <div className="font-medium">Warning signs (from document)</div>
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
                                <div className="p-3 rounded bg-red-50 border border-red-100">
                                    <div className="font-medium">General red flags</div>
                                    <ul className="list-disc ml-5">
                                        {discharge.generalRedFlags.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray((result as any)?.imagingAndProcedures) && (result as any).imagingAndProcedures.length > 0 && (
                                <div className="p-3 rounded bg-blue-50 border border-blue-100">
                                    <div className="font-medium">Imaging & Procedures</div>
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
            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-2">Questions (patient-facing)</h2>
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
            <section className="border rounded-lg p-4">
                <h2 className="font-medium mb-2">What we could not determine</h2>
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
            <section className="border rounded-lg p-4 space-y-2">
                <h2 className="font-medium">Safety information</h2>
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
                    <div className="p-3 rounded bg-red-50 border border-red-100">
                        <div className="text-sm font-medium text-red-900">Emergency note</div>
                        <p className="text-sm text-red-900 mt-1">{safety.emergencyNote}</p>
                    </div>
                )}
            </section>

            <div className="text-center">
                <Link href="/" className="text-sm text-gray-600">
                    Back to Home
                </Link>
            </div>
        </main>
    );
}