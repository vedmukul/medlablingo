"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAnalysis } from "@/lib/persistence/analysisStorage";
import type { AnalysisApiResponse } from "@/lib/persistence/analysisStorage";
import {
    AnalysisResult,
    isLabReport,
    isDischargeInstructions,
    isDischargeSummary,
} from "@/contracts/analysisSchema";

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
            <div className="max-w-4xl mx-auto p-8">
                <p className="text-gray-600">Loading analysis...</p>
            </div>
        );
    }

    if (!data || !data.result) {
        return (
            <div className="max-w-4xl mx-auto p-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold text-yellow-900 mb-2">
                        No Analysis Data Found
                    </h2>
                    <p className="text-yellow-700 mb-4">
                        No saved analysis was found. Please upload and analyze a document first.
                    </p>
                    <Link
                        href="/upload"
                        className="inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 print:hidden"
                    >
                        Go to Upload
                    </Link>
                </div>
            </div>
        );
    }

    const { documentType, readingLevel, result, requestId } = data;
    const generatedTime = new Date().toLocaleString();

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white">
            {/* Print Button - Hidden in print mode */}
            <div className="mb-6 print:hidden flex gap-4">
                <button
                    onClick={handlePrint}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                    🖨️ Print / Save as PDF
                </button>
                <Link
                    href="/results"
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                    ← Back to Results
                </Link>
            </div>

            {/* Report Header */}
            <div className="border-b-2 border-gray-300 pb-6 mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    MedLabLingo Analysis Report
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
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Summary</h2>
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        Questions to Ask Your Doctor
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Lab Results</h2>

                    {result.labsSection.overallLabNote && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                            <p className="text-sm text-blue-900">
                                <span className="font-medium">Overall Note: </span>
                                {result.labsSection.overallLabNote}
                            </p>
                        </div>
                    )}

                    {result.labsSection.labs && result.labsSection.labs.length > 0 ? (
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                                        Test Name
                                    </th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                                        Value
                                    </th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                                        Reference Range
                                    </th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                                        Flag
                                    </th>
                                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                                        Explanation
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.labsSection.labs.map((lab, index) => (
                                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="border border-gray-300 px-4 py-2 font-medium">
                                            {lab.name}
                                            {lab.importance === "high" && (
                                                <span className="ml-2 text-xs text-red-600 font-bold">
                                                    [HIGH PRIORITY]
                                                </span>
                                            )}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                            {lab.value}
                                            {lab.unit && ` ${lab.unit}`}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                            {lab.referenceRange || "N/A"}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2 font-semibold">
                                            {lab.flag.toUpperCase()}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2 text-xs">
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                Home Care Instructions
                            </h2>
                            <ul className="space-y-2">
                                {result.dischargeSection.homeCareSteps.map((step, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="mr-3 text-indigo-600 font-bold">✓</span>
                                        <span className="text-gray-800">{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Medications */}
                    {result.dischargeSection.medications && result.dischargeSection.medications.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Medications</h2>
                            <div className="space-y-4">
                                {result.dischargeSection.medications.map((med, index) => (
                                    <div key={index} className="border border-gray-300 rounded p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-gray-900">
                                                {med.name}
                                            </h3>
                                            {med.timing && <span className="bg-gray-100 px-2 py-1 text-xs font-bold rounded">⏱ {med.timing}</span>}
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <p>
                                                <span className="font-medium">Purpose:</span> {med.purposePlain}
                                            </p>
                                            <p>
                                                <span className="font-medium">How to take:</span> {med.howToTakeFromDoc}
                                            </p>
                                            {med.cautionsGeneral && (
                                                <p className="bg-yellow-50 border border-yellow-200 p-2 rounded">
                                                    <span className="font-medium">⚠️ Important:</span> {med.cautionsGeneral}
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Follow-Up Care</h2>
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Diet & Activity</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {result.dischargeSection.dietInstructions && (
                                    <div className="border p-4 rounded bg-gray-50">
                                        <h3 className="font-bold mb-2">Diet</h3>
                                        <p className="text-sm">{result.dischargeSection.dietInstructions}</p>
                                    </div>
                                )}
                                {result.dischargeSection.activityRestrictions && (
                                    <div className="border p-4 rounded bg-gray-50">
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Imaging & Procedures</h2>
                            <div className="space-y-4">
                                {(result as any).imagingAndProcedures.map((item: any, idx: number) => (
                                    <div key={idx} className="border p-4 rounded">
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                ⚠️ Warning Signs
                            </h2>
                            <ul className="list-disc ml-6 space-y-2 text-gray-800">
                                {result.dischargeSection.warningSignsFromDoc.map((sign, index) => (
                                    <li key={index}>{sign}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Red Flags */}
                    {result.dischargeSection.generalRedFlags && result.dischargeSection.generalRedFlags.length > 0 && (
                        <section className="bg-red-50 border-2 border-red-300 rounded p-4">
                            <h2 className="text-2xl font-bold text-red-900 mb-4">
                                🚨 Seek Immediate Care If:
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
                <section className="mt-8 pt-6 border-t-2 border-gray-300">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Important Safety Information
                    </h2>

                    {result.meta.safety.disclaimer && (
                        <div className="bg-gray-100 border border-gray-300 rounded p-4 mb-4">
                            <p className="text-sm text-gray-800">
                                <span className="font-semibold">Disclaimer: </span>
                                {result.meta.safety.disclaimer}
                            </p>
                        </div>
                    )}

                    {result.meta.safety.emergencyNote && (
                        <div className="bg-red-100 border-2 border-red-600 rounded p-4 mb-4">
                            <p className="text-sm font-semibold text-red-900">
                                🚨 {result.meta.safety.emergencyNote}
                            </p>
                        </div>
                    )}

                    {result.meta.safety.limitations && result.meta.safety.limitations.length > 0 && (
                        <div className="bg-gray-100 border border-gray-300 rounded p-4">
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
            <footer className="mt-8 pt-6 border-t border-gray-300 text-center text-xs text-gray-500">
                <p>Generated by MedLabLingo - Educational Use Only</p>
                <p className="mt-1">This is not a substitute for professional medical advice.</p>
            </footer>
        </div>
    );
}
