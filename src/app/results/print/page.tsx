"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    Clock,
    Printer,
    Siren,
} from "lucide-react";
import { loadAnalysis } from "@/lib/persistence/analysisStorage";
import type { AnalysisApiResponse } from "@/lib/persistence/analysisStorage";
import { isLabReport, isDischargeInstructions, isDischargeSummary } from "@/contracts/analysisSchema";

export default function PrintPage() {
    const [data, setData] = useState<AnalysisApiResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const analysis = loadAnalysis();
        setData(analysis);
        setLoading(false);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <main className="min-h-dvh bg-warmBase flex items-center justify-center p-6">
                <p className="text-[15px] text-gray-600">Loading analysis…</p>
            </main>
        );
    }

    if (!data || !data.result) {
        return (
            <main className="min-h-dvh bg-warmBase p-6">
                <div className="max-w-lg mx-auto mt-12 bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-sm">
                    <h1 className="text-xl font-serif font-semibold text-navy mb-2">No analysis to print</h1>
                    <p className="text-[14px] text-gray-600 mb-6">
                        Upload and analyze a document first, then open this page again.
                    </p>
                    <Link
                        href="/upload"
                        className="inline-flex min-h-[48px] items-center justify-center px-6 py-3 rounded-xl bg-navy text-white text-sm font-semibold hover:bg-navy-light motion-safe:transition-colors print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2"
                    >
                        Go to upload
                    </Link>
                </div>
            </main>
        );
    }

    const { documentType, readingLevel, result, requestId } = data;
    const generatedTime = new Date().toLocaleString();

    return (
        <div className="min-h-dvh bg-warmBase print:bg-white print:min-h-0">
            <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-white print:shadow-none print:p-8 rounded-none sm:rounded-2xl sm:my-6 sm:border sm:border-gray-100 sm:shadow-sm">
            {/* Actions — hidden when printing */}
            <div className="mb-6 print:hidden flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy-light motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 focus-visible:ring-offset-warmBase"
                >
                    <Printer className="w-5 h-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    Print / Save as PDF
                </button>
                <Link
                    href="/results"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 bg-sand text-navy border border-sand-dark rounded-xl text-sm font-semibold hover:bg-sand-dark/80 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 focus-visible:ring-offset-2"
                >
                    <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    Back to results
                </Link>
            </div>

            {/* Report Header */}
            <div className="border-b-2 border-gray-200 pb-6 mb-6">
                <h1 className="text-3xl font-serif font-bold text-navy mb-2">
                    MedLabLingo analysis report
                </h1>
                <div className="text-sm text-gray-600 space-y-1">
                    <p>
                        <span className="font-medium">Generated:</span> {generatedTime}
                    </p>
                    <p>
                        <span className="font-medium">Document Type:</span>{" "}
                        {documentType.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    <p>
                        <span className="font-medium">Reading Level:</span>{" "}
                        {readingLevel.charAt(0).toUpperCase() + readingLevel.slice(1)}
                    </p>
                    {requestId && (
                        <p>
                            <span className="font-medium">Request ID:</span>{" "}
                            <code className="bg-gray-100 px-1 rounded text-xs">{requestId}</code>
                        </p>
                    )}
                </div>
            </div>

            {/* Patient Summary */}
            <section className="mb-8">
                <h2 className="text-xl font-serif font-bold text-navy mb-4">Summary</h2>
                <p className="text-gray-800 mb-4 leading-relaxed">
                    {result.patientSummary.overallSummary}
                </p>

                {result.patientSummary.keyTakeaways && result.patientSummary.keyTakeaways.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Takeaways:</h3>
                        <ul className="list-disc ml-6 space-y-2 text-gray-800">
                            {result.patientSummary.keyTakeaways.map((takeaway, index) => (
                                <li key={index}>{takeaway}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            {/* Questions for Doctor */}
            {result.questionsForDoctor && result.questionsForDoctor.length > 0 && (
                <section className="mb-8">
                    <h2 className="text-xl font-serif font-bold text-navy mb-4">
                        Questions to ask your doctor
                    </h2>
                    <ol className="list-decimal ml-6 space-y-2 text-gray-800">
                        {result.questionsForDoctor.map((question, index) => (
                            <li key={index}>{question}</li>
                        ))}
                    </ol>
                </section>
            )}

            {/* Lab Report Section */}
            {isLabReport(result) && result.labsSection && (
                <section className="mb-8">
                    <h2 className="text-xl font-serif font-bold text-navy mb-4">Lab results</h2>

                    {result.labsSection.overallLabNote && (
                        <div className="bg-teal-light/60 border border-teal/25 rounded-lg p-4 mb-4">
                            <p className="text-sm text-navy">
                                <span className="font-medium">Overall Note: </span>
                                {result.labsSection.overallLabNote}
                            </p>
                        </div>
                    )}

                    {result.labsSection.labs && result.labsSection.labs.length > 0 ? (
                        <table className="w-full border-collapse border border-gray-200 text-sm">
                            <thead className="bg-sand">
                                <tr>
                                    <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-navy">
                                        Test name
                                    </th>
                                    <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-navy">
                                        Value
                                    </th>
                                    <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-navy">
                                        Reference range
                                    </th>
                                    <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-navy">
                                        Flag
                                    </th>
                                    <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-navy">
                                        Explanation
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.labsSection.labs.map((lab, index) => (
                                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-warmBase/80"}>
                                        <td className="border border-gray-200 px-4 py-2 font-medium">
                                            {lab.name}
                                            {lab.importance === "high" && (
                                                <span className="ml-2 text-xs text-red-600 font-bold">
                                                    [HIGH PRIORITY]
                                                </span>
                                            )}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-2">
                                            {lab.value}
                                            {lab.unit && ` ${lab.unit}`}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-2">
                                            {lab.referenceRange || "N/A"}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-2 font-semibold">
                                            {lab.flag.toUpperCase()}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-2 text-xs">
                                            {lab.explanation}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-600">No lab values were parsed from this document.</p>
                    )}
                </section>
            )}

            {/* Discharge Instructions Section */}
            {(isDischargeInstructions(result) || isDischargeSummary(result)) && result.dischargeSection && (
                <div className="space-y-8">
                    {/* Home Care Steps */}
                    {result.dischargeSection.homeCareSteps && result.dischargeSection.homeCareSteps.length > 0 && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4">
                                Home care instructions
                            </h2>
                            <ul className="space-y-2">
                                {result.dischargeSection.homeCareSteps.map((step, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 shrink-0 text-sage mt-1" strokeWidth={2.5} aria-hidden />
                                        <span className="text-gray-800">{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Medications */}
                    {result.dischargeSection.medications && result.dischargeSection.medications.length > 0 && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4">Medications</h2>
                            <div className="space-y-4">
                                {result.dischargeSection.medications.map((med, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-warmBase/30">
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <h3 className="font-bold text-lg text-navy">
                                                {med.name}
                                            </h3>
                                            {med.timing && (
                                                <span className="inline-flex items-center gap-1 bg-teal-light text-teal px-2 py-1 text-xs font-semibold rounded-lg shrink-0">
                                                    <Clock className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                                                    {med.timing}
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <p>
                                                <span className="font-medium">Purpose:</span> {med.purposePlain}
                                            </p>
                                            <p>
                                                <span className="font-medium">How to take:</span> {med.howToTakeFromDoc}
                                            </p>
                                            {med.cautionsGeneral && (
                                                <p className="bg-amber-light/70 border border-amber/30 p-2 rounded-lg flex gap-2 items-start text-sm">
                                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber mt-0.5" strokeWidth={2} aria-hidden />
                                                    <span>
                                                        <span className="font-medium text-amber">Important:</span>{" "}
                                                        {med.cautionsGeneral}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Follow-Up */}
                    {result.dischargeSection.followUp && result.dischargeSection.followUp.length > 0 && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4">Follow-up care</h2>
                            <ul className="list-disc ml-6 space-y-2 text-gray-800">
                                {result.dischargeSection.followUp.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Diet & Activity */}
                    {(result.dischargeSection.dietInstructions || result.dischargeSection.activityRestrictions) && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4">Diet &amp; activity</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {result.dischargeSection.dietInstructions && (
                                    <div className="border border-gray-200 p-4 rounded-lg bg-sand/50">
                                        <h3 className="font-bold mb-2">Diet</h3>
                                        <p className="text-sm">{result.dischargeSection.dietInstructions}</p>
                                    </div>
                                )}
                                {result.dischargeSection.activityRestrictions && (
                                    <div className="border border-gray-200 p-4 rounded-lg bg-sand/50">
                                        <h3 className="font-bold mb-2">Activity</h3>
                                        <p className="text-sm whitespace-pre-line">{result.dischargeSection.activityRestrictions}</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Imaging and Extra Data for Discharge Summaries */}
                    {(result as any).imagingAndProcedures && (result as any).imagingAndProcedures.length > 0 && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4">Imaging &amp; procedures</h2>
                            <div className="space-y-4">
                                {(result as any).imagingAndProcedures.map((item: any, idx: number) => (
                                    <div key={idx} className="border border-gray-200 p-4 rounded-lg">
                                        <h3 className="font-bold text-lg mb-1">{item.name} {item.date && <span className="text-sm font-normal text-gray-500">({item.date})</span>}</h3>
                                        <p className="text-sm text-gray-800 mb-2">{item.findingsPlain || item.findings}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Warning Signs */}
                    {result.dischargeSection.warningSignsFromDoc && result.dischargeSection.warningSignsFromDoc.length > 0 && (
                        <section>
                            <h2 className="text-xl font-serif font-bold text-navy mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-amber shrink-0" strokeWidth={1.75} aria-hidden />
                                Warning signs
                            </h2>
                            <ul className="list-disc ml-6 space-y-2 text-gray-800">
                                {result.dischargeSection.warningSignsFromDoc.map((sign, index) => (
                                    <li key={index}>
                                        <span className="font-semibold">{sign.symptom}</span> {" -> "}
                                        <span className="text-red-700 font-medium">{sign.action}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Red Flags */}
                    {result.dischargeSection.generalRedFlags && result.dischargeSection.generalRedFlags.length > 0 && (
                        <section className="bg-customRed-light border-2 border-customRed/40 rounded-lg p-4">
                            <h2 className="text-xl font-serif font-bold text-customRed mb-4 flex items-center gap-2">
                                <Siren className="w-6 h-6 shrink-0" strokeWidth={1.75} aria-hidden />
                                Seek immediate care if
                            </h2>
                            <ul className="list-disc ml-6 space-y-2 text-red-900 font-medium">
                                {result.dischargeSection.generalRedFlags.map((flag, index) => (
                                    <li key={index}>{flag}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}

            {/* Safety Disclaimer */}
            {result.meta && result.meta.safety && (
                <section className="mt-8 pt-6 border-t-2 border-gray-200">
                    <h2 className="text-xl font-serif font-bold text-navy mb-4">
                        Important safety information
                    </h2>

                    {result.meta.safety.disclaimer && (
                        <div className="bg-sand/60 border border-gray-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-800">
                                <span className="font-semibold">Disclaimer: </span>
                                {result.meta.safety.disclaimer}
                            </p>
                        </div>
                    )}

                    {result.meta.safety.emergencyNote && (
                        <div className="bg-customRed-light border-2 border-customRed rounded-lg p-4 mb-4 flex gap-2 items-start">
                            <Siren className="w-5 h-5 shrink-0 text-customRed mt-0.5" strokeWidth={2} aria-hidden />
                            <p className="text-sm font-semibold text-customRed">
                                {result.meta.safety.emergencyNote}
                            </p>
                        </div>
                    )}

                    {result.meta.safety.limitations && result.meta.safety.limitations.length > 0 && (
                        <div className="bg-sand/60 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-gray-900 mb-2">Limitations:</p>
                            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-800">
                                {result.meta.safety.limitations.map((limitation, index) => (
                                    <li key={index}>{limitation}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            {/* Footer */}
            <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
                <p>Generated by MedLabLingo — educational use only</p>
                <p className="mt-1">Not a substitute for professional medical advice.</p>
            </footer>
            </div>
        </div>
    );
}
