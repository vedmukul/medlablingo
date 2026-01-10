import { NextResponse } from "next/server";
import { extractText, PDFExtractionError } from "@/lib/pdf/extractText";
import { DocumentTypeSchema, ReadingLevelSchema } from "@/contracts/analysisSchema";
import { z } from "zod";

// Input validation schema
const RequestSchema = z.object({
    documentType: DocumentTypeSchema,
    readingLevel: ReadingLevelSchema,
});

/**
 * Basic PHI scrubber for the preview.
 * WARNING: This is NOT production-grade PHI removal.
 * It's only for scrubbing the preview string returned to the client.
 */
function scrubPreview(text: string): string {
    return text
        // Email pattern
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL-REDACTED]')
        // Phone pattern (generic US-like)
        .replace(/(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g, '[PHONE-REDACTED]')
        // MRN-like (6+ digits)
        .replace(/\b\d{6,}\b/g, '[MRN-REDACTED]');
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const documentType = formData.get("documentType");
        const readingLevel = formData.get("readingLevel");

        // 1. Validation
        if (!file) {
            return NextResponse.json(
                { ok: false, error: "Missing file", hint: "Please upload a PDF file" },
                { status: 400 }
            );
        }

        if (file.type !== "application/pdf") {
            return NextResponse.json(
                { ok: false, error: "Invalid file type", hint: "Only PDF files are supported" },
                { status: 400 }
            );
        }

        const inputValidation = RequestSchema.safeParse({
            documentType,
            readingLevel,
        });

        if (!inputValidation.success) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Invalid parameters",
                    details: inputValidation.error.flatten(),
                    hint: "Check documentType and readingLevel"
                },
                { status: 400 }
            );
        }

        // 2. Extraction
        const buffer = Buffer.from(await file.arrayBuffer());
        let extractedText = "";

        try {
            extractedText = await extractText(buffer);
        } catch (e) {
            console.error("PDF Extraction failed:", e);
            return NextResponse.json(
                { ok: false, error: "Text extraction failed", hint: "Try a clearer PDF or text-selectable PDF" },
                { status: 422 }
            );
        }

        if (!extractedText.trim()) {
            return NextResponse.json(
                { ok: false, error: "No text found", hint: "The PDF might be scanned images. Try a digital PDF." },
                { status: 422 }
            );
        }

        // 3. Response Preparation
        const previewRaw = extractedText.substring(0, 300).replace(/\s+/g, ' ').trim();
        const extractionPreview = scrubPreview(previewRaw);

        return NextResponse.json({
            ok: true,
            documentType: inputValidation.data.documentType,
            readingLevel: inputValidation.data.readingLevel,
            extractedTextLength: extractedText.length,
            extractionPreview,
        });

    } catch (error) {
        console.error("Analyze API Error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
