import React from 'react';

interface SummaryCardProps {
    documentType: string;
    readingLevel: string;
    extractedTextLength: number;
}

export function SummaryCard({ documentType, readingLevel, extractedTextLength }: SummaryCardProps) {
    return (
        <div className="bg-surface-card overflow-hidden shadow-card rounded-card mb-6">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-text-primary mb-4">Analysis Summary</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-text-secondary">Document Type</dt>
                        <dd className="mt-1 text-sm text-text-primary capitalize">{documentType.replace('_', ' ')}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-text-secondary">Reading Level</dt>
                        <dd className="mt-1 text-sm text-text-primary capitalize">{readingLevel}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-text-secondary">Extracted Text Length</dt>
                        <dd className="mt-1 text-sm text-text-primary">{extractedTextLength} chars</dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
