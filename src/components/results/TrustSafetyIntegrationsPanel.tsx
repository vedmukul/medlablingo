"use client";

import type { AnalysisResult } from "@/contracts/analysisSchema";
import { US_ESCALATION_DEFAULTS } from "@/lib/safety/escalationDefaults";
import { downloadClinicianHandoffJson } from "@/lib/integrations/clinicianHandoff";
import { downloadFhirBundleJson } from "@/lib/integrations/fhirBasicExport";

type Props = {
    result: AnalysisResult;
    extractedTextLength?: number;
};

function mergeEscalationForDisplay(result: AnalysisResult) {
    const eg = result.escalationGuidance;
    if (eg) {
        return {
            callEmergencyIf: eg.callEmergencyIf?.length ? eg.callEmergencyIf : [...US_ESCALATION_DEFAULTS.callEmergencyIf],
            seekUrgentCareIf: eg.seekUrgentCareIf?.length
                ? eg.seekUrgentCareIf
                : [...US_ESCALATION_DEFAULTS.seekUrgentCareIf],
            crisisNote: eg.crisisNote ?? US_ESCALATION_DEFAULTS.crisisNote,
        };
    }
    return {
        callEmergencyIf: [...US_ESCALATION_DEFAULTS.callEmergencyIf],
        seekUrgentCareIf: [...US_ESCALATION_DEFAULTS.seekUrgentCareIf],
        crisisNote: US_ESCALATION_DEFAULTS.crisisNote,
    };
}

export function TrustSafetyIntegrationsPanel({ result, extractedTextLength }: Props) {
    const tr = result.meta.traceability;
    const gaps = result.whatWeCouldNotDetermine ?? [];
    const anchors = result.documentAnchors ?? [];
    const escalation = mergeEscalationForDisplay(result);
    const truncated = tr?.documentTextWasTruncated || (extractedTextLength != null && extractedTextLength >= 50_000);

    return (
        <div className="space-y-6">
            {truncated && (
                <section className="rounded-2xl border border-amber-200 bg-amber-light/30 p-5">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber mb-2">
                        Document length notice
                    </h2>
                    <p className="text-[14px] text-gray-800 leading-relaxed">
                        Only the first portion of this PDF was analyzed (server limit). Do not rely on this summary as
                        complete — share the full PDF with your clinician or split very long documents.
                    </p>
                </section>
            )}

            <section className="rounded-2xl border border-customRed/25 bg-customRed-light/20 p-5">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-customRed mb-3">
                    When to get emergency help
                </h2>
                <p className="text-[12px] text-gray-600 mb-3">
                    Educational guide only — if you think it is an emergency, call your local emergency number (e.g. 911
                    in the U.S.).
                </p>
                <ul className="space-y-2 text-[14px] text-gray-800">
                    {escalation.callEmergencyIf.map((s, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-customRed font-bold">•</span>
                            <span>{s}</span>
                        </li>
                    ))}
                </ul>
                {escalation.seekUrgentCareIf && escalation.seekUrgentCareIf.length > 0 && (
                    <>
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mt-4 mb-2">
                            Urgent care or same-day visit
                        </h3>
                        <ul className="space-y-2 text-[14px] text-gray-700">
                            {escalation.seekUrgentCareIf.map((s, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="text-amber font-bold">•</span>
                                    <span>{s}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                {escalation.crisisNote && (
                    <p className="text-[13px] text-gray-600 mt-4 pt-3 border-t border-customRed/10">{escalation.crisisNote}</p>
                )}
            </section>

            {gaps.length > 0 && (
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                        What we could not determine
                    </h2>
                    <p className="text-[12px] text-gray-500 mb-3">
                        Limits of this pass — ask your care team about anything that matters for your decisions.
                    </p>
                    <ul className="space-y-2">
                        {gaps.map((g, i) => (
                            <li key={i} className="text-[14px] text-gray-700 flex gap-2">
                                <span className="text-gray-300">—</span>
                                <span>{g}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {anchors.length > 0 && (
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                        Grounded in your document
                    </h2>
                    <p className="text-[12px] text-gray-500 mb-4">
                        Short excerpts the model tied to its explanations (verify against your original PDF).
                    </p>
                    <div className="space-y-4">
                        {anchors.map((a, i) => (
                            <blockquote key={i} className="border-l-[3px] border-teal pl-4 py-1">
                                <p className="text-[11px] font-semibold text-teal uppercase tracking-wide mb-1">{a.topic}</p>
                                <p className="text-[13px] text-gray-700 leading-relaxed font-mono bg-warmBase/50 rounded-r-lg p-3">
                                    {a.verbatimExcerpt}
                                </p>
                            </blockquote>
                        ))}
                    </div>
                </section>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Traceability & handoff
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-gray-600">
                    {result.meta.modelInfo && (
                        <>
                            <dt className="font-semibold text-gray-500">Model</dt>
                            <dd>
                                {result.meta.modelInfo.provider} / {result.meta.modelInfo.modelName}
                            </dd>
                        </>
                    )}
                    {tr && (
                        <>
                            <dt className="font-semibold text-gray-500">Pipeline</dt>
                            <dd>{tr.pipelineVersion}</dd>
                            <dt className="font-semibold text-gray-500">Prompt set</dt>
                            <dd>{tr.promptVersion}</dd>
                            {tr.analyzedCharacterCount != null && (
                                <>
                                    <dt className="font-semibold text-gray-500">Chars analyzed</dt>
                                    <dd>{tr.analyzedCharacterCount.toLocaleString()}</dd>
                                </>
                            )}
                        </>
                    )}
                    <dt className="font-semibold text-gray-500">Schema</dt>
                    <dd>{result.meta.schemaVersion}</dd>
                </dl>
                <div className="flex flex-wrap gap-2 pt-2">
                    <button
                        type="button"
                        onClick={() => downloadClinicianHandoffJson(result)}
                        className="px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-semibold hover:bg-navy-light transition-colors"
                    >
                        Download clinician packet (JSON)
                    </button>
                    <button
                        type="button"
                        onClick={() => downloadFhirBundleJson(result)}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-[13px] font-semibold hover:bg-gray-50 transition-colors"
                    >
                        FHIR outline (JSON)
                    </button>
                    <a
                        href="/results/print"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-[13px] font-semibold hover:bg-gray-50 transition-colors inline-flex items-center"
                    >
                        Printable report
                    </a>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    JSON exports are for bringing to an appointment or plugging into pilot integrations — not a legal
                    medical record. FHIR bundle is a minimal demo outline, not a validated interoperability profile.
                </p>
            </section>
        </div>
    );
}
