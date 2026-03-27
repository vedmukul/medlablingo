import type { AnalysisResult } from "@/contracts/analysisSchema";

/**
 * Minimal FHIR R4-style bundle for pilot / integration demos.
 * Not a complete clinical record — DocumentReference + a few Observations from labs when present.
 */
export function buildFhirBundleOutline(
    result: AnalysisResult,
    options?: { patientDisplay?: string }
): Record<string, unknown> {
    const idBase = `medlablingo-${Date.now()}`;
    const patientRef = { reference: `Patient/${idBase}-patient`, display: options?.patientDisplay ?? "Patient (unlinked)" };

    const entries: Record<string, unknown>[] = [];

    entries.push({
        fullUrl: `urn:uuid:${idBase}-doc`,
        resource: {
            resourceType: "DocumentReference",
            id: `${idBase}-doc`,
            status: "current",
            type: {
                text: result.meta.documentType.replace(/_/g, " "),
            },
            subject: patientRef,
            date: result.meta.createdAt,
            description: result.patientSummary.overallSummary.slice(0, 500),
        },
    });

    if ("labsSection" in result && result.labsSection?.labs?.length) {
        for (let i = 0; i < result.labsSection.labs.length; i++) {
            const lab = result.labsSection.labs[i];
            entries.push({
                fullUrl: `urn:uuid:${idBase}-obs-${i}`,
                resource: {
                    resourceType: "Observation",
                    id: `${idBase}-obs-${i}`,
                    status: "final",
                    subject: patientRef,
                    code: { text: lab.name },
                    valueString: [lab.value, lab.unit].filter(Boolean).join(" "),
                    note: [{ text: lab.explanation?.slice(0, 500) ?? "" }],
                },
            });
        }
    }

    return {
        resourceType: "Bundle",
        id: idBase,
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: entries,
    };
}

export function downloadFhirBundleJson(result: AnalysisResult, filename = "medlablingo-fhir-outline.json") {
    const bundle = buildFhirBundleOutline(result);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
