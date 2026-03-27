import type { AnalysisResult } from "@/contracts/analysisSchema";
import { PIPELINE_VERSION, PROMPT_VERSION } from "@/lib/pipeline/versioning";

export type ClinicianHandoffPayload = {
    generatedAt: string;
    pipelineVersion: string;
    promptVersion: string;
    summaryForClinician: string;
    keyTakeaways: string[];
    questionsPatientMayAsk: string[];
    gapsOrUncertainties: string[];
    documentAnchors?: Array<{ topic: string; verbatimExcerpt: string }>;
    escalationHighlights?: {
        callEmergencyIf: string[];
        seekUrgentCareIf?: string[];
        crisisNote?: string;
    };
    rawMeta?: AnalysisResult["meta"];
};

export function buildClinicianHandoffPayload(result: AnalysisResult): ClinicianHandoffPayload {
    const ps = result.patientSummary;
    return {
        generatedAt: new Date().toISOString(),
        pipelineVersion: PIPELINE_VERSION,
        promptVersion: PROMPT_VERSION,
        summaryForClinician: ps.overallSummary,
        keyTakeaways: ps.keyTakeaways,
        questionsPatientMayAsk: result.questionsForDoctor,
        gapsOrUncertainties: result.whatWeCouldNotDetermine,
        documentAnchors: result.documentAnchors,
        escalationHighlights: result.escalationGuidance,
        rawMeta: result.meta,
    };
}

export function downloadClinicianHandoffJson(result: AnalysisResult, filename = "medlablingo-clinician-handoff.json") {
    const payload = buildClinicianHandoffPayload(result);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
