import {
    AnalysisResult,
    validateAnalysisResult,
} from "../../contracts/analysisSchema";
import { redact } from "../safety/redact";
import { resolveProvider, getModelInfo } from "./providers/resolve";
import type { ModelInfo } from "./providers/resolve";

/**
 * Input parameters for document analysis
 */
export interface AnalyzeDocumentInput {
    text: string;
    documentType: "lab_report" | "discharge_instructions" | "discharge_summary";
    readingLevel: "simple" | "standard";
}

/**
 * Analyzes a document and returns structured, validated results.
 *
 * This function:
 * 1. Redacts PII from input text
 * 2. Sends redacted text to the resolved AI provider with structured prompts
 * 3. Validates the response against AnalysisSchema
 * 4. Post-processes confidence arrays to ensure length matches
 * 5. Retries once if validation fails
 * 6. Returns mock data if no API key is configured
 *
 * @param input - Document text, type, and reading level
 * @returns Promise<AnalysisResult> - Validated analysis result with confidence signals
 * @throws Error if validation fails after retry or API call fails
 *
 * @example
 * // With API key configured
 * const result = await analyzeDocument({
 *   text: "Patient glucose: 95 mg/dL...",
 *   documentType: "lab_report",
 *   readingLevel: "simple"
 * });
 *
 * @example
 * // Without API key (returns mock data)
 * const mockResult = await analyzeDocument({
 *   text: "Any text...",
 *   documentType: "discharge_instructions",
 *   readingLevel: "standard"
 * });
 */
export async function analyzeDocument(
    input: AnalyzeDocumentInput
): Promise<AnalysisResult> {
    const { text, documentType, readingLevel } = input;

    // Validate input
    if (!text || typeof text !== "string") {
        throw new Error("Invalid input: text must be a non-empty string");
    }

    // Resolve AI provider (Anthropic → Google → OpenAI → Mock)
    const provider = resolveProvider();
    if (!provider) {
        console.warn(
            "[analyzeDocument] No AI provider API key found - returning mock data"
        );
        return getMockAnalysisResult(documentType, readingLevel);
    }

    const modelInfo: ModelInfo = getModelInfo(provider);

    // Step 1: Redact PII before sending to LLM
    const redactedText = redact(text);

    // Step 2: Build LLM prompt with confidence guidance
    const systemPrompt = buildSystemPrompt(documentType, readingLevel);
    const userPrompt = buildUserPrompt(redactedText, documentType);

    // Step 3: Call AI provider
    let llmResponse: string;
    try {
        llmResponse = await provider.callAI(systemPrompt, userPrompt);
    } catch (error) {
        throw new Error(
            `Failed to analyze document: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }

    // Step 4: Parse and post-process response
    // Gemini sometimes writes literal `undefined` which is not valid JSON
    llmResponse = llmResponse.replace(/:\s*undefined\b/g, ": null");

    let parsedResponse: unknown;
    try {
        parsedResponse = JSON.parse(llmResponse);
    } catch (parseErr) {
        console.error(
            "[analyzeDocument] JSON.parse error:", (parseErr as Error).message
        );
        console.error(
            "[analyzeDocument] Last 300 chars:",
            llmResponse.substring(llmResponse.length - 300)
        );

        // Attempt to fix truncated JSON by closing open braces/brackets
        let fixed = llmResponse.trim();
        const opens = (fixed.match(/{/g) || []).length;
        const closes = (fixed.match(/}/g) || []).length;
        if (opens > closes) {
            // Remove trailing comma or partial content after last complete value
            fixed = fixed.replace(/,\s*[^}\]]*$/, "");
            for (let i = 0; i < opens - closes; i++) fixed += "}";
            try {
                parsedResponse = JSON.parse(fixed);
                console.log("[analyzeDocument] Fixed truncated JSON successfully");
            } catch {
                throw new Error(
                    "LLM returned invalid JSON. Please try again or contact support."
                );
            }
        } else {
            throw new Error(
                "LLM returned invalid JSON. Please try again or contact support."
            );
        }
    }

    parsedResponse = postProcessResponse(parsedResponse, modelInfo, documentType, readingLevel);

    // Debug: log the shape of the processed response
    const debugShape = parsedResponse && typeof parsedResponse === "object"
        ? {
            topKeys: Object.keys(parsedResponse as any),
            metaKeys: (parsedResponse as any).meta ? Object.keys((parsedResponse as any).meta) : "MISSING",
            metaDocType: (parsedResponse as any).meta?.documentType,
            metaSchemaVer: (parsedResponse as any).meta?.schemaVersion,
            metaSafetyKeys: (parsedResponse as any).meta?.safety ? Object.keys((parsedResponse as any).meta.safety) : "MISSING",
            hasLabsSection: !!(parsedResponse as any).labsSection,
            hasDischargeSection: !!(parsedResponse as any).dischargeSection,
            questionsCount: Array.isArray((parsedResponse as any).questionsForDoctor) ? (parsedResponse as any).questionsForDoctor.length : "NOT_ARRAY",
            patientSummaryKeys: (parsedResponse as any).patientSummary ? Object.keys((parsedResponse as any).patientSummary) : "MISSING",
        }
        : "NOT_OBJECT";
    console.log("[analyzeDocument] Post-processed shape:", JSON.stringify(debugShape));

    const validationResult = validateAnalysisResult(parsedResponse);

    if (validationResult.ok) {
        return validationResult.data;
    }

    // Deep-dive: try each branch separately to get useful errors
    const { AnalysisSchemaUnion } = require("../../contracts/analysisSchema");
    // In Zod v4, union errors often just say "Invalid input".
    // Validate against individual branches for detailed errors.
    const asAny = parsedResponse as any;
    if (asAny?.meta?.documentType === "lab_report") {
        console.error("[analyzeDocument] Lab branch validation detail:",
            JSON.stringify(AnalysisSchemaUnion.safeParse(parsedResponse)));
    }

    // Step 5: Retry once with schema errors
    const issues = validationResult.error.issues ?? (validationResult.error as any).errors ?? [];
    console.warn(
        "[analyzeDocument] Initial validation failed, retrying with schema errors.",
        "Validation issues (full):",
        JSON.stringify(validationResult.error, null, 2).substring(0, 2000)
    );

    const retryPrompt = buildRetryPrompt(
        redactedText,
        documentType,
        llmResponse,
        validationResult.error
    );

    let retryResponse: string;
    try {
        retryResponse = await provider.callAI(systemPrompt, retryPrompt);
    } catch (error) {
        throw new Error(
            `Retry failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }

    // Parse and validate retry response
    let retryParsed: unknown;
    try {
        retryParsed = JSON.parse(retryResponse);
    } catch (error) {
        console.error(
            "[analyzeDocument] Retry response is not valid JSON. First 500 chars:",
            retryResponse.substring(0, 500)
        );
        throw new Error(
            "Analysis failed validation. Please try uploading the document again."
        );
    }

    retryParsed = postProcessResponse(retryParsed, modelInfo, documentType, readingLevel);

    const retryValidation = validateAnalysisResult(retryParsed);

    if (retryValidation.ok) {
        return retryValidation.data;
    }

    // Final failure - return safe error message
    throw new Error(
        "Unable to analyze document in the expected format. Please try again or contact support if the issue persists."
    );
}

/**
 * Picks only allowed keys from an object, discarding everything else.
 * Prevents `.strict()` schema failures caused by extra LLM-generated fields.
 */
function pick<T extends Record<string, unknown>>(
    obj: T,
    allowed: readonly string[]
): Partial<T> {
    const out: any = {};
    for (const key of allowed) {
        if (key in obj) out[key] = (obj as any)[key];
    }
    return out;
}

/**
 * Finds the first value in `obj` whose key matches one of `aliases`,
 * or returns `fallback` if none match.
 */
function findByAlias(obj: any, aliases: readonly string[], fallback?: any): any {
    for (const key of aliases) {
        if (key in obj && obj[key] !== undefined) return obj[key];
    }
    return fallback;
}

/**
 * Coerces a value to a string. Handles the common LLM pattern of returning
 * nested objects like {text: "...", confidence: 0.9} instead of plain strings.
 */
function coerceToString(value: any): string {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
        const candidate = value.text ?? value.summary ?? value.content ??
            value.description ?? value.value ?? value.explanation ?? value.message;
        if (typeof candidate === "string") return candidate;
        const strings = Object.values(value).filter(v => typeof v === "string");
        if (strings.length > 0) return strings.join(" ");
    }
    if (value != null) return String(value);
    return "";
}

/**
 * Coerces an array (possibly of objects) into a string[].
 * Handles LLMs returning [{text: "..."}, ...] instead of ["..."].
 */
function coerceToStringArray(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item: any) => coerceToString(item))
        .filter((s: string) => s.length > 0);
}

/**
 * Helper to coerce an optional scalar value into a string if it exists.
 */
function coerceOptionalString(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = coerceToString(value).trim();
    return str.length > 0 ? str : undefined;
}

/**
 * Normalizes a string value to one of the allowed enum values, or returns fallback.
 */
function normalizeEnum(value: any, allowed: readonly string[], fallback: string): string {
    if (typeof value === "string") {
        const lower = value.toLowerCase().trim();
        for (const opt of allowed) {
            if (lower === opt || lower.includes(opt)) return opt;
        }
    }
    return fallback;
}

/**
 * Finds the first array value in an object (ignoring a set of excluded keys).
 */
function findFirstArray(obj: any, exclude: Set<string> = new Set()): any[] | undefined {
    for (const key of Object.keys(obj)) {
        if (!exclude.has(key) && Array.isArray(obj[key])) return obj[key];
    }
    return undefined;
}

/**
 * Post-processes the LLM response to ensure schema compliance.
 *
 * LLMs (especially Claude) commonly return JSON that fails `.strict()` schemas:
 *   - Wrong enum values (e.g. "discharge_summary" instead of "discharge_instructions")
 *   - Wrong field names (e.g. "disclaimers" array instead of "disclaimer" string)
 *   - Extra fields the schema doesn't define
 *   - `null` instead of omitting a key (JSON has no `undefined`)
 *
 * Rather than trusting the LLM for metadata we already know, this function
 * force-overrides meta fields from the original request and whitelists
 * every key at every nesting level so `.strict()` schemas always pass.
 */
function postProcessResponse(
    response: unknown,
    modelInfo: ModelInfo,
    knownDocumentType: "lab_report" | "discharge_instructions" | "discharge_summary",
    knownReadingLevel: "simple" | "standard"
): unknown {
    if (!response || typeof response !== "object") {
        return response;
    }

    const raw = response as any;

    // ── 1. Enforce section exclusivity based on the REQUESTED type ──
    if (knownDocumentType === "lab_report") {
        delete raw.dischargeSection;
    } else if (knownDocumentType === "discharge_instructions") {
        delete raw.labsSection;
    }
    if (raw.dischargeSection === null) delete raw.dischargeSection;
    if (raw.labsSection === null) delete raw.labsSection;

    // ── 2. Top-level: normalize field names, then pick ──
    const questionsForDoctor = findByAlias(raw, [
        "questionsForDoctor", "questions_for_doctor", "questions",
        "doctorQuestions", "patientQuestions", "suggestedQuestions",
    ]);
    const whatWeCouldNotDetermine = findByAlias(raw, [
        "whatWeCouldNotDetermine", "what_we_could_not_determine",
        "limitations", "uncertainties", "undetermined", "cannotDetermine",
    ]);

    // Rebuild top-level with normalized names
    const coercedQuestions = coerceToStringArray(questionsForDoctor);
    raw.questionsForDoctor = coercedQuestions.length > 0
        ? coercedQuestions
        : ["What do these results mean for my health?", "Are any values concerning?",
            "Do I need follow-up tests?", "Should I make any lifestyle changes?",
            "When should I have my next checkup?"];
    raw.whatWeCouldNotDetermine = coerceToStringArray(whatWeCouldNotDetermine);

    // Ensure questionsForDoctor has 5-10 items
    while (raw.questionsForDoctor.length < 5) {
        raw.questionsForDoctor.push("What else should I know about my health?");
    }
    if (raw.questionsForDoctor.length > 10) {
        raw.questionsForDoctor = raw.questionsForDoctor.slice(0, 10);
    }

    const TOP_KEYS = [
        "meta", "patientSummary", "questionsForDoctor",
        "questionsForDoctorConfidence", "whatWeCouldNotDetermine",
        "labsSection", "dischargeSection", "imagingAndProcedures", "discontinuedMedications",
    ] as const;
    const result: any = pick(raw, TOP_KEYS);

    // ── 3. Meta — force-override with known values ──
    const rawMeta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
    const rawSafety = rawMeta.safety && typeof rawMeta.safety === "object" ? rawMeta.safety : {};

    // LLMs sometimes use "disclaimers" (array) instead of "disclaimer" (string)
    let disclaimer: string =
        typeof rawSafety.disclaimer === "string"
            ? rawSafety.disclaimer
            : Array.isArray(rawSafety.disclaimers)
                ? rawSafety.disclaimers.join(" ")
                : "This is educational information only, not medical advice. Always consult your healthcare provider.";

    let limitations: string[] =
        Array.isArray(rawSafety.limitations)
            ? rawSafety.limitations.filter((s: unknown) => typeof s === "string")
            : ["Cannot diagnose conditions", "Cannot recommend treatments"];

    let emergencyNote: string =
        typeof rawSafety.emergencyNote === "string"
            ? rawSafety.emergencyNote
            : typeof rawSafety.emergency_note === "string"
                ? rawSafety.emergency_note
                : "If you have urgent symptoms, call 911 or go to the emergency room immediately.";

    let createdAt: string =
        typeof rawMeta.createdAt === "string" ? rawMeta.createdAt : new Date().toISOString();
    if (!createdAt.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(createdAt)) {
        createdAt += "Z";
    }

    result.meta = {
        schemaVersion: "1.0.0" as const,
        createdAt,
        documentType: knownDocumentType,
        readingLevel: knownReadingLevel,
        language: typeof rawMeta.language === "string" ? rawMeta.language : "en",
        provenance: { source: "pdf_upload" as const },
        safety: { disclaimer, limitations, emergencyNote },
        modelInfo: {
            provider: modelInfo.provider,
            modelName: modelInfo.modelName,
            temperature: modelInfo.temperature,
        },
    };

    // ── 4. Patient Summary (normalize field names then pick) ──
    // Gemini sometimes returns patientSummary as an array of strings instead of
    // the expected {overallSummary, keyTakeaways} object. Detect and handle.
    let rawPS: any = result.patientSummary;

    if (Array.isArray(rawPS)) {
        console.log("[analyzeDocument] patientSummary is an ARRAY (len=" + rawPS.length + "), converting to object");
        const items = coerceToStringArray(rawPS);
        rawPS = {
            overallSummary: items[0] || "",
            keyTakeaways: items.slice(1),
        };
    }

    // Also check if the AI placed summary fields at the top level instead of nesting
    if (!rawPS || typeof rawPS !== "object") {
        rawPS = {};
    }
    if (!rawPS.overallSummary && !rawPS.summary) {
        const topLevelSummary = findByAlias(raw, [
            "overallSummary", "overall_summary", "summary", "analysis", "overview",
        ]);
        if (topLevelSummary) rawPS.overallSummary = topLevelSummary;
    }
    if (!rawPS.keyTakeaways && !rawPS.takeaways) {
        const topLevelTakeaways = findByAlias(raw, [
            "keyTakeaways", "key_takeaways", "takeaways", "keyPoints", "highlights",
        ]);
        if (topLevelTakeaways) rawPS.keyTakeaways = topLevelTakeaways;
    }

    if (rawPS && typeof rawPS === "object" && !Array.isArray(rawPS)) {
        console.log("[analyzeDocument] patientSummary keys:", Object.keys(rawPS),
            "overallSummary type:", typeof rawPS.overallSummary,
            "keyTakeaways type:", typeof rawPS.keyTakeaways,
            Array.isArray(rawPS.keyTakeaways) ? `(len=${rawPS.keyTakeaways.length})` : "");

        const rawSummary = findByAlias(rawPS, [
            "overallSummary", "overall_summary", "summary",
            "overallAnalysis", "generalSummary", "patientSummary",
            "analysis", "overview",
        ]);
        const rawTakeaways = findByAlias(rawPS, [
            "keyTakeaways", "key_takeaways", "takeaways",
            "keyPoints", "key_points", "highlights", "mainPoints",
        ]);

        const overallSummary = coerceToString(rawSummary);
        const keyTakeaways = coerceToStringArray(rawTakeaways);

        result.patientSummary = {
            overallSummary: overallSummary ||
                "Analysis completed. See key takeaways and questions for your doctor below.",
            keyTakeaways: keyTakeaways.length > 0
                ? keyTakeaways.slice(0, 7)
                : ["Please review the document details with your healthcare provider"],
        };

        // Preserve optional confidence fields if present and valid
        if (typeof rawPS.overallSummaryConfidence === "number") {
            result.patientSummary.overallSummaryConfidence = rawPS.overallSummaryConfidence;
        }
        if (Array.isArray(rawPS.keyTakeawaysConfidence) &&
            rawPS.keyTakeawaysConfidence.length === result.patientSummary.keyTakeaways.length) {
            result.patientSummary.keyTakeawaysConfidence = rawPS.keyTakeawaysConfidence;
        }

        // Ensure min 3 takeaways
        while (result.patientSummary.keyTakeaways.length < 3) {
            result.patientSummary.keyTakeaways.push(
                "Discuss any questions or concerns with your healthcare provider"
            );
        }
    } else {
        result.patientSummary = {
            overallSummary: "Analysis completed. See questions for your doctor below.",
            keyTakeaways: [
                "Review this document with your healthcare provider",
                "Ask your doctor about anything you don't understand",
                "Keep this document for your records",
            ],
        };
    }

    // ── 5. Labs Section (normalize field names then pick) ──
    if (result.labsSection && typeof result.labsSection === "object") {
        const rawLabs = result.labsSection;

        const overallLabNote = findByAlias(rawLabs, [
            "overallLabNote", "overall_lab_note", "overallNote",
            "summary", "labSummary", "note", "overview",
        ]);
        const labs = findByAlias(rawLabs, [
            "labs", "labResults", "lab_results", "results",
            "labItems", "lab_items", "tests", "testResults",
        ]) ?? findFirstArray(rawLabs) ?? [];

        result.labsSection = {
            overallLabNote: typeof overallLabNote === "string" ? overallLabNote : undefined,
            labs: Array.isArray(labs)
                ? labs.map((lab: any) => {
                    if (!lab || typeof lab !== "object") return lab;

                    // Robust extraction for explanation to handle LLM arbitrarily nesting objects
                    let rawExp = findByAlias(lab, ["explanation", "description", "interpretation", "meaning", "details", "comment", "note"]) ?? "No explanation available.";
                    let explanation = typeof rawExp === "string" ? rawExp :
                        (typeof rawExp === "object" && rawExp !== null) ?
                            Object.values(rawExp).filter(v => typeof v === "string").join(" ") :
                            String(rawExp);

                    return {
                        name: findByAlias(lab, ["name", "testName", "test_name", "labName", "lab_name", "test", "parameter"]) ?? "Unknown",
                        value: String(findByAlias(lab, ["value", "result", "testValue", "test_value", "resultValue", "measured"]) ?? "N/A"),
                        unit: findByAlias(lab, ["unit", "units", "measurementUnit", "uom"]) ?? null,
                        referenceRange: findByAlias(lab, ["referenceRange", "reference_range", "normalRange", "normal_range", "range", "refRange"]) ?? null,
                        flag: normalizeEnum(
                            findByAlias(lab, ["flag", "status", "result_flag", "abnormalFlag", "indicator"]),
                            ["low", "high", "normal", "borderline", "unknown"],
                            "unknown"
                        ),
                        importance: normalizeEnum(
                            findByAlias(lab, ["importance", "priority", "severity", "significance", "clinicalSignificance"]),
                            ["low", "medium", "high", "unknown"],
                            "unknown"
                        ),
                        explanation,
                        trend: Array.isArray(lab.trend) ? lab.trend.map((t: any) => ({
                            date: String(findByAlias(t, ["date", "timepoint", "time"]) ?? "Unknown Date"),
                            value: String(findByAlias(t, ["value", "result"]) ?? "N/A")
                        })) : undefined,
                        trendInterpretation: normalizeEnum(
                            findByAlias(lab, ["trendInterpretation", "trend_interpretation", "trendString"]),
                            ["Improving", "Worsening", "Stable", "Resolved", "Unknown"],
                            "Unknown"
                        ),
                        ...(typeof lab.confidenceScore === "number" ? { confidenceScore: lab.confidenceScore } : {}),
                    };
                })
                : [],
        };
    }

    // ── 6. Discharge Section (normalize field names then pick) ──
    if (result.dischargeSection && typeof result.dischargeSection === "object") {
        const rawDC = result.dischargeSection;

        result.dischargeSection = {
            status: (rawDC.status === "approved" ? "approved" : "draft") as "draft" | "approved",
            homeCareSteps: coerceToStringArray(findByAlias(rawDC, ["homeCareSteps", "home_care_steps", "homeCare", "homeInstructions", "careInstructions"])),
            medications: findByAlias(rawDC, ["medications", "medication", "meds", "prescriptions"]) ?? [],
            followUp: coerceToStringArray(findByAlias(rawDC, ["followUp", "follow_up", "followUpInstructions", "followUpAppointments"])),
            warningSignsFromDoc: Array.isArray(findByAlias(rawDC, ["warningSignsFromDoc", "warning_signs", "warningSignsFromDocument", "warningSigns", "redFlagsFromDoc"]))
                ? findByAlias(rawDC, ["warningSignsFromDoc", "warning_signs", "warningSignsFromDocument", "warningSigns", "redFlagsFromDoc"]).map((ws: any) => {
                    if (!ws || typeof ws !== "object") return { symptom: coerceToString(ws), action: "Contact healthcare provider" };
                    return {
                        symptom: coerceToString(findByAlias(ws, ["symptom", "sign", "warning", "threshold"])) || "Unknown Warning",
                        action: coerceToString(findByAlias(ws, ["action", "whatToDo", "instruction", "response"])) || "Contact healthcare provider",
                    };
                }) : [],
            generalRedFlags: coerceToStringArray(findByAlias(rawDC, ["generalRedFlags", "general_red_flags", "redFlags", "emergencySigns"])),
            diagnosesMentionedInDoc: coerceToStringArray(findByAlias(rawDC, ["diagnosesMentionedInDoc", "diagnoses", "diagnosis", "diagnosesMentioned", "conditions"])),
        };

        if (knownDocumentType === "discharge_summary") {
            const followUpStructured = findByAlias(rawDC, ["followUpStructured", "follow_up_structured", "appointments"]);
            if (Array.isArray(followUpStructured)) {
                result.dischargeSection.followUpStructured = followUpStructured.map((f: any) => {
                    if (!f || typeof f !== "object") return f;
                    return {
                        specialty: coerceToString(findByAlias(f, ["specialty", "department", "clinic"])) || "Unknown",
                        provider: coerceOptionalString(findByAlias(f, ["provider", "doctor", "physician", "name"])),
                        dateTime: coerceToString(findByAlias(f, ["dateTime", "date_time", "date", "time", "when"])) || "Unknown",
                        purpose: coerceToString(findByAlias(f, ["purpose", "reason", "why"])) || "Follow-up",
                        urgency: normalizeEnum(findByAlias(f, ["urgency", "priority"]), ["routine", "important", "critical"], "routine"),
                    };
                });
            }

            result.dischargeSection.dietInstructions = coerceOptionalString(findByAlias(rawDC, ["dietInstructions", "diet_instructions", "diet"]));
            result.dischargeSection.activityRestrictions = coerceOptionalString(findByAlias(rawDC, ["activityRestrictions", "activity_restrictions", "activity"]));
            result.dischargeSection.dailyMonitoring = coerceToStringArray(findByAlias(rawDC, ["dailyMonitoring", "daily_monitoring", "monitoring"]));
            result.dischargeSection.feedingPlan = coerceOptionalString(findByAlias(rawDC, ["feedingPlan", "feeding_plan", "feeding"]));
            result.dischargeSection.safeSleepInstructions = coerceOptionalString(findByAlias(rawDC, ["safeSleepInstructions", "safe_sleep_instructions", "safeSleep", "sleep"]));
            result.dischargeSection.woundCare = coerceOptionalString(findByAlias(rawDC, ["woundCare", "wound_care", "incisionCare"]));
            result.dischargeSection.respiratoryPrecautions = coerceOptionalString(findByAlias(rawDC, ["respiratoryPrecautions", "respiratory_precautions"]));
            result.dischargeSection.developmentalGuidance = coerceOptionalString(findByAlias(rawDC, ["developmentalGuidance", "developmental_guidance"]));
        }

        if (Array.isArray(result.dischargeSection.medications)) {
            result.dischargeSection.medications = result.dischargeSection.medications.map((med: any) => {
                if (!med || typeof med !== "object") return med;
                return {
                    name: coerceToString(findByAlias(med, ["name", "medication", "drug", "med"])) || "Unknown Medication",
                    purposePlain: coerceToString(findByAlias(med, ["purposePlain", "purpose", "reason", "indication", "why"])) || "",
                    howToTakeFromDoc: coerceToString(findByAlias(med, ["howToTakeFromDoc", "howToTake", "instructions", "directions", "dosage"])) || "",
                    cautionsGeneral: coerceToString(findByAlias(med, ["cautionsGeneral", "cautions", "warnings", "sideEffects", "notes"])) || "",
                    timing: coerceOptionalString(findByAlias(med, ["timing", "whenToTake", "schedule", "frequency"])),
                };
            });
        }
    }

    if (knownDocumentType === "discharge_summary") {
        const rawImaging = findByAlias(raw, ["imagingAndProcedures", "imaging_and_procedures", "imaging", "procedures"]);
        if (Array.isArray(rawImaging)) {
            result.imagingAndProcedures = rawImaging.map((i: any) => {
                if (!i || typeof i !== "object") return i;
                return {
                    name: coerceToString(findByAlias(i, ["name", "procedure", "test"])) || "Unknown Imaging",
                    date: coerceOptionalString(findByAlias(i, ["date", "time", "performed"])),
                    findingsPlain: coerceToString(findByAlias(i, ["findingsPlain", "findings", "results", "conclusion", "summary"])) || "No findings detailed.",
                    ...(Array.isArray(i.keyValues) ? { keyValues: i.keyValues } : {}),
                    ...(typeof i.confidenceScore === "number" ? { confidenceScore: i.confidenceScore } : {}),
                };
            });
        }

        const rawDiscMeds = findByAlias(raw, ["discontinuedMedications", "discontinued_medications", "stoppedMedications", "stoppedMeds"]);
        if (Array.isArray(rawDiscMeds)) {
            result.discontinuedMedications = rawDiscMeds.map((m: any) => {
                if (!m || typeof m !== "object") return m;
                return {
                    name: coerceToString(findByAlias(m, ["name", "medication", "drug"])) || "Unknown Medication",
                    reasonPlain: coerceToString(findByAlias(m, ["reasonPlain", "reason", "why", "cause"])) || "No reason specified.",
                    replacedBy: coerceOptionalString(findByAlias(m, ["replacedBy", "replacement", "switchedTo"])),
                };
            });
        }

        const rawImmunizations = findByAlias(raw, ["immunizations", "vaccines", "vaccinations", "shotRecord"]);
        if (Array.isArray(rawImmunizations)) {
            result.immunizations = rawImmunizations.map((i: any) => {
                if (!i || typeof i !== "object") return i;
                return {
                    name: coerceToString(findByAlias(i, ["name", "vaccine", "shot"])) || "Unknown Immunization",
                    date: coerceToString(findByAlias(i, ["date", "given", "administered"])) || "Unknown Date",
                    notes: coerceOptionalString(findByAlias(i, ["notes", "details", "comment"])),
                };
            });
        }

        const rawBirthHistory = findByAlias(raw, ["birthHistory", "birth_history"]);
        if (typeof rawBirthHistory === "string") result.birthHistory = rawBirthHistory;

        const rawHospitalCourse = findByAlias(raw, ["hospitalCourse", "hospital_course", "course"]);
        if (typeof rawHospitalCourse === "string") result.hospitalCourse = rawHospitalCourse;
    }

    // ── 7. Guarantee the required section exists ──
    // Claude sometimes ignores the requested type and returns the wrong section.
    // After deleting the wrong section above, the required one may be missing.
    if (knownDocumentType === "lab_report" && !result.labsSection) {
        result.labsSection = {
            overallLabNote: "No lab-specific data could be extracted from this document.",
            labs: [],
        };
    }
    if ((knownDocumentType === "discharge_instructions" || knownDocumentType === "discharge_summary") && !result.dischargeSection) {
        result.dischargeSection = {
            status: "draft" as const,
            homeCareSteps: [],
            medications: [],
            followUp: [],
            warningSignsFromDoc: [],
            generalRedFlags: [
                "Severe chest pain",
                "Difficulty breathing",
                "Sudden confusion",
            ],
            diagnosesMentionedInDoc: [],
        };
    }

    return result;
}

/**
 * Builds the system prompt based on document type and reading level
 * Now includes guidance on confidence scoring
 */
export function buildSystemPrompt(
    documentType: "lab_report" | "discharge_instructions" | "discharge_summary",
    readingLevel: "simple" | "standard"
): string {
    const readingLevelGuidance =
        readingLevel === "simple"
            ? "Use 5th-grade plain English. Avoid all medical jargon. Explain concepts using simple everyday analogies.\n"
            : "Use clear, standard clinical English. Explain complex medical terms briefly when first used. Keep tone professional but accessible.\n";

    let optLabText = "";
    if (documentType === "lab_report") {
        optLabText = "- labsSection: analysis of lab results (REQUIRED). Do NOT include dischargeSection at all.\n";
    } else if (documentType === "discharge_instructions") {
        optLabText = "- dischargeSection: discharge instructions breakdown (REQUIRED). Do NOT include labsSection at all.\n";
    } else {
        optLabText = `When documentType is "discharge_summary":

You are analyzing a comprehensive medical discharge summary. These documents are hybrid —
they contain BOTH clinical data (lab results, imaging, procedures) AND patient instructions
(medications, home care, follow-up, warning signs). You MUST extract EVERYTHING from BOTH sides.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE: EXTRACT EVERYTHING. DO NOT SUMMARIZE OR TRUNCATE.
═══════════════════════════════════════════════════════════════

If the document lists 15 medications, return ALL 15 with full details.
If there are 8 follow-up appointments, return ALL 8.
If there are 50 lab values, return ALL 50 — including normal results.
This is the patient's instruction manual for going home. Every detail is safety-critical.

EXTRACTION REQUIREMENTS BY SECTION (all fields populate the schema):

1. PATIENT SUMMARY (patientSummary):
   - overallSummary: 3-5 sentence plain-language overview of why they were hospitalized, 
     what happened, and how they are at discharge
   - keyTakeaways: 3-7 bullet points covering the most important things the patient/family 
     needs to understand. For NICU documents, address PARENTS ("your baby"), not the patient.

2. LAB RESULTS (labsSection):
   - Extract EVERY lab value from the document, including:
     * Normal results (patients need reassurance and completeness)
     * Abnormal results with context-specific explanations
     * Screening tests (NBS, ABR) — use the qualitative result as the "value"
   - For serial/trending values (same test at multiple timepoints):
     * Use the MOST RECENT value as the primary value
     * In the explanation, state all available values with dates/timepoints
       (e.g., "Your BNP was 4,280 at admission, decreased to 3,120 on day 3, 
       1,840 on day 5, and 980 at discharge — showing steady improvement")
     * Characterize the trend: "improving", "worsening", "stable", or "resolved"
   - For each lab explanation:
     * Connect to the patient's SPECIFIC diagnoses, not generic definitions
     * Mention related medications when relevant (e.g., "TSH is monitored because 
       amiodarone can affect thyroid function")
     * Cross-reference related labs (e.g., "Low iron, low TSAT, and high TIBC together 
       confirm iron deficiency")
     * Never use vague language like "might be related to your condition" — name the condition
   - Use NEONATAL reference ranges for infant documents, and explicitly note when a value 
     would be abnormal in adults but is normal in neonates

3. DISCHARGE MEDICATIONS (dischargeSection.medications):
   - Extract EVERY medication, no exceptions. Include:
     * name: The full medication name with both generic and brand names
       Format: "Generic Name (Brand Name)" e.g., "Sacubitril/Valsartan (Entresto)"
       NEVER return "Unknown Medication" or leave the name field empty.
     * Exact dosing from the document (dose, route, frequency)
     * Plain-language purpose ("This helps your heart pump better")
     * Timing relative to other medications ("Take metolazone 30 minutes BEFORE furosemide")
     * Specific cautions and what to watch for
   - For supplements (Vitamin D, iron, multivitamins), include the exact product name and 
     when to start if delayed

4. DISCONTINUED MEDICATIONS (discontinuedMedications):
   - If any medications were STOPPED, list each with:
     * name: The specific medication name (e.g., "Metformin"). NEVER "Unknown Medication".
     * reasonPlain: The plain-language reason it was stopped. The source document ALWAYS states why medications were discontinued. Look for "contraindicated in...", "replaced by...", etc. NEVER return "No reason specified".
     * replacedBy: Name of the replacement medication if applicable
   - This is safety-critical: patients need to know what they should NO LONGER take

5. HOME CARE INSTRUCTIONS (dischargeSection.homeCareSteps):
   - Extract EVERY instruction: diet, activity, wound care, monitoring tasks, restrictions
   - Preserve specific numbers (sodium grams, fluid limits, calorie targets, weight thresholds)
   - Include WHEN to call the doctor for each instruction where applicable

6. DIET INSTRUCTIONS (dischargeSection.dietInstructions):
   - Extract ALL dietary restrictions and targets as a single comprehensive string
   - Include: sodium limit, fluid restriction, calorie target, special diet type, supplements

7. ACTIVITY RESTRICTIONS (dischargeSection.activityRestrictions):
   - Include lifting limits, exercise guidance, cardiac rehab referrals, return-to-work timelines

8. DAILY MONITORING (dischargeSection.dailyMonitoring):
   - Extract EVERY daily self-monitoring task as an array of specific instructions
   - Include exact thresholds ("Call if weight increases >3 lbs in 24 hours")
   - Include timing ("Weigh every morning BEFORE breakfast, AFTER urinating")
   - DEDUPLICATION: If an instruction like "weigh daily" belongs here, extract it HERE and do NOT repeat it in homeCareSteps. Use the most specific section.

9. FEEDING PLAN (dischargeSection.feedingPlan) — for neonatal documents:
   - Extract exact volumes (mL), frequencies (times/day), caloric density (kcal/oz)
   - Include formula name and preparation
   - Include output expectations (wet diapers, stools per day)
   - Include weight gain targets (g/day)
   - Include alert thresholds ("Contact pediatrician if feeding <6 times in 24 hours")

10. SAFE SLEEP INSTRUCTIONS (dischargeSection.safeSleepInstructions) — for neonatal:
    - Extract COMPLETELY. This is SIDS prevention and is life-safety content.
    - Include: position, mattress, what NOT to put in crib, room-sharing guidance
    - Preserve any emphasis about premature infants being at HIGHER risk

11. WARNING SIGNS (dischargeSection.warningSignsFromDoc):
    - STRUCTURE AS AN OBJECT WITH TWO FIELDS:
      * symptom: the sign or threshold (e.g., "Weight increase > 3 lbs in 24 hours")
      * action: what to do (e.g., "Call the heart failure clinic")
    - Preserve exact numbers (temperature >100.4°F, breathing >60/min, etc.)

12. FOLLOW-UP APPOINTMENTS (dischargeSection.followUpStructured):
    - Extract ALL appointments with specialty, provider, date/time, purpose
    - If the document marks any as urgent/critical ("do NOT miss"), set urgency to "critical"
    - Include recurring appointments (weekly weight checks, monthly injections)

13. IMAGING & PROCEDURES (imagingAndProcedures):
    - Extract each study/procedure with date, plain-language findings, and key measurements
    - NEVER return generic names like "Unknown" or "Unknown Imaging". Extract the specific study name (e.g., "Transthoracic Echocardiogram (TTE)", "Chest X-Ray (CXR)", "Thoracentesis", "Right Heart Catheterization (Swan-Ganz)")
    - For echocardiograms: EF, valve findings, pressures
    - For X-rays: what they showed and how it changed
    - For procedures: what was done, how much fluid removed, results
    - Date: Also extract the specific date or timing (e.g., "Admission", "Day 2", "Day 7", "Pre-discharge"). NEVER use [DOB REDACTED] or other redaction tokens as dates. If the date was redacted, use the relative timing instead ("Admission", "Day 7").

14. IMMUNIZATIONS (immunizations) — especially for pediatric documents:
    - List all administered vaccines with dates
    - Include upcoming schedule
    - For specialty vaccines (Palivizumab/Synagis), include weight-based dosing and schedule

15. WOUND CARE (dischargeSection.woundCare):
    - Extract dressing type, change frequency, cleaning instructions
    - Include signs of infection to watch for

16. RESPIRATORY PRECAUTIONS (dischargeSection.respiratoryPrecautions):
    - Hand hygiene requirements, crowd avoidance, smoke exposure, visitor restrictions

17. DEVELOPMENTAL GUIDANCE (dischargeSection.developmentalGuidance):
    - Corrected vs chronological age explanation
    - Early intervention referrals
    - PT/OT evaluation timelines

18. DIAGNOSES (dischargeSection.diagnosesMentionedInDoc):
    - List ALL diagnoses: principal, secondary, comorbid, historical
    - Include staging/grading where provided (CKD Stage IV, ROP Stage 2 Zone II, etc.)

19. QUESTIONS FOR DOCTOR (questionsForDoctor):
    - Generate 5-10 questions specific to THIS patient's conditions
    - Reference specific values, medications, and findings from the document
    - For pediatric documents, frame questions for parents

20. WHAT WE COULD NOT DETERMINE (whatWeCouldNotDetermine):
    - List anything that was unclear, incomplete, or potentially redacted
    - Be specific about what's missing and why it matters

AUDIENCE DETECTION:
- If the document is a NICU/pediatric discharge, address PARENTS ("your baby") throughout
- If the document is an adult discharge, address the PATIENT ("you/your")
- If unclear, default to patient-directed language

CONFIDENCE SCORING:
- Include confidence scores (0.0-1.0) for all AI-generated content
- Higher confidence for information directly stated in the document
- Lower confidence for inferred or interpreted information
- Omit confidence score if you cannot reasonably assess it

LAB EXTRACTION RULES — MANDATORY:

1. INCLUDE ALL LABS. Every single lab value in the document must appear in your output.
   Normal results are NOT optional — they provide reassurance and clinical context.

2. NEVER SKIP NORMAL RESULTS. A normal TSH matters when the patient is on amiodarone.
   A normal procalcitonin matters when the patient had suspected sepsis. A normal
   platelet count matters when the patient is on anticoagulants. Context determines
   importance, not just the flag.

3. SERIAL VALUES: When the same test appears at multiple timepoints:
   - Primary value = most recent (discharge) value
   - Explanation MUST include ALL timepoints with dates
   - State the trend direction explicitly
   - Example: "Your BNP decreased steadily during your stay: 4,280 (admission) -> 3,120 
     (day 3) -> 1,840 (day 5) -> 980 (discharge). This improving trend indicates your 
     heart failure treatment is working, though the level remains elevated."

4. CROSS-REFERENCE RELATED LABS in explanations:
   - Iron studies: Connect iron, TIBC, TSAT, ferritin together
   - Kidney panel: Connect BUN, creatinine, eGFR, phosphorus, uric acid
   - Nutrition: Connect albumin, pre-albumin, total protein
   - Anemia: Connect Hgb, Hct, RBC, MCV, MCH, MCHC, RDW, retic count
   - Liver: Connect AST, ALT, Alk Phos, bilirubin (total + direct), GGT

5. LAB FLAGS: Always compute the correct \`flag\` enum ("normal", "high", "low", "borderline").
   - NEVER use "unknown" if you have both the measured value and the reference range.
   - If a value is 150 and the range is 135-145, the flag is "high". Compute this objectively.

6. SPECIFIC EXPLANATIONS: Never say "might be related to your condition."
   Always name the specific condition and explain the mechanism.
   - BAD: "Your high BUN might be related to your condition."
   - GOOD: "Your high BUN (48 mg/dL) reflects your kidneys' reduced ability to filter waste, 
     consistent with your Stage IV chronic kidney disease."

7. MEDICATION CONNECTIONS: When a lab is monitored because of a specific medication,
   say so:
   - "TSH is checked because amiodarone can affect thyroid function"
   - "Potassium is monitored closely because spironolactone can raise potassium levels"
   - "Liver enzymes are tracked because amiodarone and statins can both affect the liver"

8. NEONATAL REFERENCE RANGES: For infant documents, always use age-appropriate ranges.
   If a value would be abnormal in adults but normal in neonates, explicitly note this
   to prevent parental anxiety from Googling adult ranges.`;

    }

    const redactionHandling = `
REDACTION HANDLING:
The input text contains [FILTERED] or [REDACTED] tokens where personal health information
was removed before being sent to you. In ALL of your output text (summaries, explanations,
takeaways, instructions), you must:
1. NEVER include [FILTERED], [REDACTED], [DOB REDACTED], or any bracket-token in output
2. Write around redacted information naturally:
   BAD: "[FILTERED] severe heart failure..."
   GOOD: "You have severe heart failure..."
   BAD: "The type of anemia [FILTERED]"  
   GOOD: "The type of anemia you have"
   BAD: "[DOB REDACTED] — Intake"
   GOOD: "Next day after discharge — Intake" (use relative timing)
3. For dates that were redacted, substitute with relative timing:
   - "Next day after discharge" instead of "[DOB REDACTED]"
   - "2 weeks post-discharge" instead of specific redacted date
4. If a sentence becomes meaningless after removing a redaction token,
   rewrite the entire sentence rather than leaving a gap
`;

    return redactionHandling + "CRITICAL INSTRUCTIONS:\n" +
        "1. Your PRIMARY GOAL is to simplify and explain the document's contents.\n" +
        "2. DO NOT refuse to summarize the document. Explaining medical terminology and lab results DOES NOT constitute medical advice.\n" +
        "3. DO NOT insert safety disclaimers or tell the patient \"Please consult your doctor to understand this\" in your summaries. Our application UI handles all medical disclaimers automatically. Just provide the educational explanation.\n" +
        "4. Never diagnose conditions, recommend treatments, or suggest medication changes.\n\n" +
        "Your role is strictly to help patients understand what their documents say and prepare questions for their doctors.\n\n" +
        "DOCUMENT TYPE: " + documentType + "\n" +
        "READING LEVEL: " + readingLevel + "\n" +
        "STYLE GUIDANCE: " + readingLevelGuidance + "\n\n" +
        "CONFIDENCE SCORING GUIDELINES:\n" +
        "- Include optional confidence scores (0.0 to 1.0) where appropriate\n" +
        "- Base confidence on:\n" +
        "  * Document clarity: Is the information clearly stated?\n" +
        "  * Explicitness: Is the information directly stated or inferred?\n" +
        "  * Completeness: Is all necessary context present?\n" +
        "- ONLY include confidence scores when you have a reasonable basis for the score\n" +
        "- If unsure about confidence, OMIT the confidence field entirely (do not guess or hallucinate)\n" +
        "- Confidence scores help users understand which information is more certain vs. inferred\n\n" +
        "OUTPUT FORMAT:\n" +
        "- Respond with ONLY valid JSON\n" +
        "- Do NOT include markdown code fences (```json)\n" +
        "- Do NOT include any explanatory text before or after the JSON\n" +
        "- The JSON must exactly match the required schema for " + documentType + "\n" +
        "- Include modelInfo will be added automatically (do not include it)\n\n" +
        "REQUIRED FIELDS:\n" +
        "- meta: metadata about the analysis (schemaVersion: \"1.0.0\", createdAt, documentType, readingLevel, language, provenance, safety)\n" +
        "- patientSummary: overall summary and key takeaways (3-7 items)\n" +
        "- questionsForDoctor: 5-10 questions the patient should ask their doctor\n" +
        "- whatWeCouldNotDetermine: things we couldn't interpret from the document\n" +
        optLabText + "\n" +
        "Remember: Educational only, not medical advice. Always include safety disclaimers.";
}

/**
 * Builds the user prompt with document text and confidence guidance
 */
function buildUserPrompt(
    redactedText: string,
    documentType: "lab_report" | "discharge_instructions" | "discharge_summary"
): string {
    const docTypeStr = documentType.replace("_", " ");
    const includeStr = documentType === "lab_report"
        ? "Include labsSection. Do NOT include dischargeSection."
        : documentType === "discharge_instructions"
            ? "Include dischargeSection. Do NOT include labsSection."
            : `Include dischargeSection. Labs, imaging, and discontinued meds are optional.

CRITICAL COMPLETENESS CHECK before returning your response:
□ Did I include ALL lab values from every table (even normal ones)?
□ Did I include ALL medications listed in the discharge medications section?
□ Did I include ALL follow-up appointments?
□ Did I include ALL warning signs with specific thresholds?
□ Did I include ALL home care instructions (diet, activity, monitoring, wound care)?
□ Did I extract imaging/procedure findings if present?
□ Did I list discontinued medications with reasons if present?
□ Did I include immunization records if present?
□ Did I include feeding plan details if this is a neonatal document?
□ Did I include safe sleep instructions if this is a neonatal document?
□ Are any [FILTERED] or [REDACTED] tokens in my output? (They should NOT be)
□ Did I use specific language instead of vague phrases?

If any checkbox fails, go back and fix it before responding.`;

    return "Analyze this " + docTypeStr + " and provide educational insights to help the patient understand it and prepare for their doctor visit.\n\n" +
        "Document text:\n" +
        redactedText + "\n\n" +
        "Remember:\n" +
        "1. Output ONLY valid JSON (no markdown, no extra text)\n" +
        "2. Match the exact schema for " + documentType + "\n" +
        "3. " + includeStr + "\n" +
        "4. Focus strictly on explaining and simplifying the text. Do not provide medical advice.\n" +
        "5. DO NOT refuse to explain the document. DO NOT add disclaimers telling the user to consult their doctor for an explanation; provide the explanation yourself.\n" +
        "6. Add confidence scores (0.0-1.0) where you have reasonable certainty based on document clarity and explicitness\n" +
        "7. If unsure about a confidence value, omit it rather than guessing";
}

/**
 * Builds a retry prompt when validation fails
 */
function buildRetryPrompt(
    redactedText: string,
    documentType: "lab_report" | "discharge_instructions" | "discharge_summary",
    previousResponse: string,
    validationError: any
): string {
    const issues = validationError.issues ?? validationError.errors ?? [];
    const errorSummary = issues
        .slice(0, 5)
        .map((e: any) => "- " + (e.path ?? []).join(".") + ": " + e.message)
        .join("\n");

    return "Your previous response had validation errors. Please fix them and output ONLY the corrected JSON.\n\n" +
        "Document text:\n" +
        redactedText + "\n\n" +
        "Previous response (INVALID):\n" +
        previousResponse + "\n\n" +
        "Validation errors:\n" +
        errorSummary + "\n\n" +
        "Output the FIXED JSON now (no markdown, no explanation, just the JSON):";
}

/**
 * Returns mock analysis result for testing without API key
 */
function getMockAnalysisResult(
    documentType: "lab_report" | "discharge_instructions" | "discharge_summary",
    readingLevel: "simple" | "standard"
): AnalysisResult {
    const baseMeta = {
        schemaVersion: "1.0.0" as const,
        createdAt: new Date().toISOString(),
        documentType,
        readingLevel,
        language: "en",
        provenance: {
            source: "pdf_upload" as const,
        },
        safety: {
            disclaimer:
                "This is educational information only, not medical advice. Always consult your healthcare provider.",
            limitations: [
                "Cannot diagnose conditions",
                "Cannot recommend treatments",
                "Cannot interpret complex clinical contexts",
            ],
            emergencyNote:
                "If you have urgent symptoms, call 911 or go to the emergency room immediately.",
        },
    };

    if (documentType === "lab_report") {
        return {
            meta: { ...baseMeta, documentType: "lab_report" as const },
            patientSummary: {
                overallSummary:
                    "Mock analysis: This is sample data returned when no API key is configured.",
                keyTakeaways: [
                    "This is mock data for testing",
                    "Configure ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY for real analysis",
                    "All values are placeholders",
                ],
            },
            questionsForDoctor: [
                "What do these results mean for my health?",
                "Are any values concerning?",
                "Do I need follow-up tests?",
                "Should I make any lifestyle changes?",
                "When should I have my next checkup?",
            ],
            whatWeCouldNotDetermine: [
                "Real analysis pending API key configuration",
            ],
            labsSection: {
                overallLabNote:
                    "Mock lab analysis - configure API key for real results",
                labs: [
                    {
                        name: "Sodium",
                        value: "135",
                        unit: "mEq/L",
                        referenceRange: "135-145",
                        flag: "low",
                        importance: "medium",
                        explanation:
                            "Mock explanation: Your sodium is slightly low. This could be due to medications like diuretics.",
                        trend: [
                            { date: "2023-10-01", value: "142" },
                            { date: "2023-11-15", value: "138" },
                            { date: "2023-12-05", value: "135" },
                        ],
                        trendInterpretation: "Worsening",
                    },
                    {
                        name: "Potassium",
                        value: "4.2",
                        unit: "mEq/L",
                        referenceRange: "3.5-5.0",
                        flag: "normal",
                        importance: "low",
                        explanation:
                            "Mock explanation: Your potassium is normal. The medication seems to be keeping it stable.",
                        trend: [
                            { date: "2023-10-01", value: "3.2" },
                            { date: "2023-11-15", value: "3.8" },
                            { date: "2023-12-05", value: "4.2" },
                        ],
                        trendInterpretation: "Improving",
                    },
                ],
            },
            dischargeSection: undefined,
        };
    } else if (documentType === "discharge_summary") {
        return {
            meta: {
                ...baseMeta,
                documentType: "discharge_summary" as const,
            },
            patientSummary: {
                overallSummary:
                    "Mock analysis: This is sample data returned when no API key is configured.",
                keyTakeaways: [
                    "This is mock data for testing",
                    "Configure ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY for real analysis",
                    "All values are placeholders",
                ],
            },
            questionsForDoctor: [
                "What signs should I watch for at home?",
                "When do I need to follow up?",
                "Are these medications necessary?",
                "What activities should I avoid?",
                "When can I return to normal activities?",
            ],
            whatWeCouldNotDetermine: [
                "Real analysis pending API key configuration",
            ],
            labsSection: {
                overallLabNote: "Mock lab analysis",
                labs: [
                    {
                        name: "Sodium",
                        value: "135",
                        unit: "mEq/L",
                        referenceRange: "135-145",
                        flag: "low",
                        importance: "medium",
                        explanation: "Mock explanation: Your sodium is slightly low.",
                        trend: [
                            { date: "2023-12-01", value: "132" },
                            { date: "2023-12-05", value: "135" },
                        ],
                        trendInterpretation: "Improving",
                    }
                ]
            },
            dischargeSection: {
                status: "draft" as const,
                homeCareSteps: ["Mock home care instruction"],
                medications: [{
                    name: "Mock Medication",
                    purposePlain: "Mock purpose",
                    howToTakeFromDoc: "Take 1 pill daily",
                    timing: "Morning",
                    cautionsGeneral: "Mock caution"
                }],
                followUp: ["Mock follow-up instruction"],
                followUpStructured: [{
                    specialty: "Primary Care",
                    provider: "Dr. Mock",
                    dateTime: "Next Tuesday 10am",
                    purpose: "Mock follow-up",
                    urgency: "routine"
                }],
                warningSignsFromDoc: [{ symptom: "Fever > 100.4", action: "Call provider" }],
                generalRedFlags: ["Severe chest pain", "Difficulty breathing", "Sudden confusion"],
                diagnosesMentionedInDoc: ["Mock diagnosis"],
                dietInstructions: "Mock diet instructions",
                activityRestrictions: "Mock activity restrictions",
                dailyMonitoring: ["Mock monitoring task"],
                feedingPlan: "Mock feeding plan",
                safeSleepInstructions: "Mock safe sleep instructions",
                woundCare: "Mock wound care",
                respiratoryPrecautions: "Mock respiratory precautions",
                developmentalGuidance: "Mock developmental guidance",
            },
            imagingAndProcedures: [{
                name: "Mock Imaging",
                date: "Mock Date",
                findingsPlain: "Mock findings",
                keyValues: [{ label: "Mock key", value: "Mock value", interpretation: "Mock interpretation" }],
                confidenceScore: 0.9,
            }],
            discontinuedMedications: [{
                name: "Mock Discontinued",
                reasonPlain: "Mock reason",
                replacedBy: "Mock replacement",
            }],
            immunizations: [{
                name: "Mock Immunization",
                date: "Mock Date",
                notes: "Mock notes",
            }],
            birthHistory: "Mock birth history",
            hospitalCourse: "Mock hospital course",
        };
    } else {
        return {
            meta: {
                ...baseMeta,
                documentType: "discharge_instructions" as const,
            },
            patientSummary: {
                overallSummary:
                    "Mock analysis: This is sample data returned when no API key is configured.",
                keyTakeaways: [
                    "This is mock data for testing",
                    "Configure ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY for real analysis",
                    "All values are placeholders",
                ],
            },
            questionsForDoctor: [
                "What signs should I watch for at home?",
                "When do I need to follow up?",
                "Are these medications necessary?",
                "What activities should I avoid?",
                "When can I return to normal activities?",
            ],
            whatWeCouldNotDetermine: [
                "Real analysis pending API key configuration",
            ],
            labsSection: undefined,
            dischargeSection: {
                status: "draft" as const,
                homeCareSteps: ["Mock home care instruction"],
                medications: [],
                followUp: ["Mock follow-up instruction"],
                warningSignsFromDoc: [],
                generalRedFlags: [
                    "Severe chest pain",
                    "Difficulty breathing",
                    "Sudden confusion",
                ],
                diagnosesMentionedInDoc: [],
            },
        };
    }
}
