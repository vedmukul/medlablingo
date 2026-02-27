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
    documentType: "lab_report" | "discharge_instructions";
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
    knownDocumentType: "lab_report" | "discharge_instructions",
    knownReadingLevel: "simple" | "standard"
): unknown {
    if (!response || typeof response !== "object") {
        return response;
    }

    const raw = response as any;

    // ── 1. Enforce section exclusivity based on the REQUESTED type ──
    if (knownDocumentType === "lab_report") {
        delete raw.dischargeSection;
    } else {
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
        "labsSection", "dischargeSection",
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
            homeCareSteps: findByAlias(rawDC, ["homeCareSteps", "home_care_steps", "homeCare", "homeInstructions", "careInstructions"]) ?? [],
            medications: findByAlias(rawDC, ["medications", "medication", "meds", "prescriptions"]) ?? [],
            followUp: findByAlias(rawDC, ["followUp", "follow_up", "followUpInstructions", "followUpAppointments"]) ?? [],
            warningSignsFromDoc: findByAlias(rawDC, ["warningSignsFromDoc", "warning_signs", "warningSignsFromDocument", "warningSigns", "redFlagsFromDoc"]) ?? [],
            generalRedFlags: findByAlias(rawDC, ["generalRedFlags", "general_red_flags", "redFlags", "emergencySigns"]) ?? [],
            diagnosesMentionedInDoc: findByAlias(rawDC, ["diagnosesMentionedInDoc", "diagnoses", "diagnosis", "diagnosesMentioned", "conditions"]) ?? [],
        };

        if (Array.isArray(result.dischargeSection.medications)) {
            const MED_KEYS = [
                "name", "purposePlain", "howToTakeFromDoc", "cautionsGeneral",
            ] as const;
            result.dischargeSection.medications = result.dischargeSection.medications.map(
                (med: any) =>
                    med && typeof med === "object" ? pick(med, MED_KEYS) : med
            );
        }
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
    if (knownDocumentType === "discharge_instructions" && !result.dischargeSection) {
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
function buildSystemPrompt(
    documentType: "lab_report" | "discharge_instructions",
    readingLevel: "simple" | "standard"
): string {
    const readingLevelGuidance =
        readingLevel === "simple"
            ? "Use plain, everyday language suitable for a 6th-8th grade reading level. Avoid medical jargon."
            : "Use clear, professional language suitable for an educated general audience. Define technical terms when used.";

    return `You are an expert medical AI assistant. Your specific job is to help patients understand the contents of their medical documents by translating complex clinical jargon into plain, patient-friendly language. You are educational ONLY.

CRITICAL INSTRUCTIONS:
1. Your PRIMARY GOAL is to simplify and explain the document's contents.
2. DO NOT refuse to summarize the document. Explaining medical terminology and lab results DOES NOT constitute medical advice.
3. DO NOT insert safety disclaimers or tell the patient "Please consult your doctor to understand this" in your summaries. Our application UI handles all medical disclaimers automatically. Just provide the educational explanation.
4. Never diagnose conditions, recommend treatments, or suggest medication changes.

Your role is strictly to help patients understand what their documents say and prepare questions for their doctors.

DOCUMENT TYPE: ${documentType}
READING LEVEL: ${readingLevel}
STYLE GUIDANCE: ${readingLevelGuidance}

CONFIDENCE SCORING GUIDELINES:
- Include optional confidence scores (0.0 to 1.0) where appropriate
- Base confidence on:
  * Document clarity: Is the information clearly stated?
  * Explicitness: Is the information directly stated or inferred?
  * Completeness: Is all necessary context present?
- ONLY include confidence scores when you have a reasonable basis for the score
- If unsure about confidence, OMIT the confidence field entirely (do not guess or hallucinate)
- Confidence scores help users understand which information is more certain vs. inferred

OUTPUT FORMAT:
- Respond with ONLY valid JSON
- Do NOT include markdown code fences (\`\`\`json)
- Do NOT include any explanatory text before or after the JSON
- The JSON must exactly match the required schema for ${documentType}
- Include modelInfo will be added automatically (do not include it)

REQUIRED FIELDS:
- meta: metadata about the analysis (schemaVersion: "1.0.0", createdAt, documentType, readingLevel, language, provenance, safety)
- patientSummary: overall summary and key takeaways (3-7 items)
- questionsForDoctor: 5-10 questions the patient should ask their doctor
- whatWeCouldNotDetermine: things we couldn't interpret from the document
${documentType === "lab_report" ? "- labsSection: analysis of lab results (REQUIRED). Do NOT include dischargeSection at all." : "- dischargeSection: discharge instructions breakdown (REQUIRED). Do NOT include labsSection at all."}

Remember: Educational only, not medical advice. Always include safety disclaimers.`;
}

/**
 * Builds the user prompt with document text and confidence guidance
 */
function buildUserPrompt(
    redactedText: string,
    documentType: "lab_report" | "discharge_instructions"
): string {
    return `Analyze this ${documentType.replace("_", " ")} and provide educational insights to help the patient understand it and prepare for their doctor visit.

Document text:
${redactedText}

Remember:
1. Output ONLY valid JSON (no markdown, no extra text)
2. Match the exact schema for ${documentType}
3. ${documentType === "lab_report" ? "Include labsSection. Do NOT include dischargeSection." : "Include dischargeSection. Do NOT include labsSection."}
4. Focus strictly on explaining and simplifying the text. Do not provide medical advice.
5. DO NOT refuse to explain the document. DO NOT add disclaimers telling the user to consult their doctor for an explanation; provide the explanation yourself.
6. Add confidence scores (0.0-1.0) where you have reasonable certainty based on document clarity and explicitness
7. If unsure about a confidence value, omit it rather than guessing`;
}

/**
 * Builds a retry prompt when validation fails
 */
function buildRetryPrompt(
    redactedText: string,
    documentType: "lab_report" | "discharge_instructions",
    previousResponse: string,
    validationError: any
): string {
    const issues = validationError.issues ?? validationError.errors ?? [];
    const errorSummary = issues
        .slice(0, 5)
        .map((e: any) => `- ${(e.path ?? []).join(".")}: ${e.message}`)
        .join("\n");

    return `Your previous response had validation errors. Please fix them and output ONLY the corrected JSON.

Document text:
${redactedText}

Previous response (INVALID):
${previousResponse}

Validation errors:
${errorSummary}

Output the FIXED JSON now (no markdown, no explanation, just the JSON):`;
}

/**
 * Returns mock analysis result for testing without API key
 */
function getMockAnalysisResult(
    documentType: "lab_report" | "discharge_instructions",
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
                labs: [],
            },
            dischargeSection: undefined,
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
