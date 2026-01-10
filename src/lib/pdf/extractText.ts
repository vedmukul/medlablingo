// @ts-ignore
const pdf = require('pdf-parse/lib/pdf-parse.js');

export class PDFExtractionError extends Error {
    constructor(message: string, public cause?: unknown) {
        super(message);
        this.name = 'PDFExtractionError';
    }
}

/**
 * Extracts raw text from a PDF buffer using pdf-parse.
 * @param buffer - The PDF file buffer
 * @returns The extracted text content
 * @throws PDFExtractionError if parsing fails
 */
export async function extractText(buffer: Buffer): Promise<string> {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        throw new PDFExtractionError('Failed to extract text from PDF', error);
    }
}
