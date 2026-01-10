import {
    AnalysisResult,
    validateAnalysisResult,
} from "../../contracts/analysisSchema";
import { redact } from "../safety/redact";

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
 * 2. Sends redacted text to OpenAI with structured prompts
 * 3. Validates the response against AnalysisSchema
 * 4. Retries once if validation fails
 * 5. Returns mock data if no API key is configured
 *
 * @param input - Document text, type, and reading level
 * @returns Promise<AnalysisResult> - Validated analysis result
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

    // Check for API key - if missing, return mock data
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn(
            "[analyzeDocument] No OPENAI_API_KEY found - returning mock data"
        );
        return getMockAnalysisResult(documentType, readingLevel);
    }

    // Step 1: Redact PII before sending to LLM
    const redactedText = redact(text);

    // Step 2: Build LLM prompt
    const systemPrompt = buildSystemPrompt(documentType, readingLevel);
    const userPrompt = buildUserPrompt(redactedText, documentType);

    // Step 3: Call OpenAI API
    let llmResponse: string;
    try {
        llmResponse = await callOpenAI(systemPrompt, userPrompt, apiKey);
    } catch (error) {
        throw new Error(
            `Failed to analyze document: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }

    // Step 4: Parse and validate response
    let parsedResponse: unknown;
    try {
        parsedResponse = JSON.parse(llmResponse);
    } catch (error) {
        throw new Error(
            "LLM returned invalid JSON. Please try again or contact support."
        );
    }

    const validationResult = validateAnalysisResult(parsedResponse);

    if (validationResult.ok) {
        return validationResult.data;
    }

    // Step 5: Retry once with schema errors
    console.warn(
        "[analyzeDocument] Initial validation failed, retrying with schema errors"
    );

    const retryPrompt = buildRetryPrompt(
        redactedText,
        documentType,
        llmResponse,
        validationResult.error
    );

    let retryResponse: string;
    try {
        retryResponse = await callOpenAI(systemPrompt, retryPrompt, apiKey);
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
        throw new Error(
            "Analysis failed validation. Please try uploading the document again."
        );
    }

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
 * Builds the system prompt based on document type and reading level
 */
function buildSystemPrompt(
    documentType: "lab_report" | "discharge_instructions",
    readingLevel: "simple" | "standard"
): string {
    const readingLevelGuidance =
        readingLevel === "simple"
            ? "Use plain, everyday language suitable for a 6th-8th grade reading level. Avoid medical jargon."
            : "Use clear, professional language suitable for an educated general audience. Define technical terms when used.";

    return `You are an AI assistant that helps patients understand their medical documents. You are educational ONLY.

CRITICAL SAFETY RULES:
- Never diagnose conditions
- Never recommend treatments
- Never suggest medication changes
- Never provide medical advice
- Always encourage consulting with healthcare providers

Your role is to help patients understand what their documents say and prepare questions for their doctors.

DOCUMENT TYPE: ${documentType}
READING LEVEL: ${readingLevel}
STYLE GUIDANCE: ${readingLevelGuidance}

OUTPUT FORMAT:
- Respond with ONLY valid JSON
- Do NOT include markdown code fences (\`\`\`json)
- Do NOT include any explanatory text before or after the JSON
- The JSON must exactly match the required schema for ${documentType}

REQUIRED FIELDS:
- meta: metadata about the analysis (schemaVersion: "1.0.0", createdAt, documentType, readingLevel, language, provenance, safety)
- patientSummary: overall summary and key takeaways (3-7 items)
- questionsForDoctor: 5-10 questions the patient should ask their doctor
- whatWeCouldNotDetermine: things we couldn't interpret from the document
${documentType === "lab_report" ? "- labsSection: analysis of lab results (REQUIRED, dischargeSection must be undefined)" : "- dischargeSection: discharge instructions breakdown (REQUIRED, labsSection must be undefined)"}

Remember: Educational only, not medical advice. Always include safety disclaimers.`;
}

/**
 * Builds the user prompt with document text
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
3. ${documentType === "lab_report" ? "Include labsSection, set dischargeSection to undefined" : "Include dischargeSection, set labsSection to undefined"}
4. Educational only - no diagnosis, treatment advice, or medication changes
5. Include appropriate safety disclaimers`;
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
    const errorSummary = validationError.errors
        .slice(0, 5)
        .map((e: any) => `- ${e.path.join(".")}: ${e.message}`)
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
 * Calls OpenAI API with the given prompts
 */
async function callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("OpenAI returned empty response");
    }

    return content;
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
                    "Configure OPENAI_API_KEY for real analysis",
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
                overallLabNote: "Mock lab analysis - configure API key for real results",
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
                    "Configure OPENAI_API_KEY for real analysis",
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
