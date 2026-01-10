import React from 'react';

interface SummaryCardProps {
    documentType: string;
    readingLevel: string;
    extractedTextLength: number;
}

export function SummaryCard({ documentType, readingLevel, extractedTextLength }: SummaryCardProps) {
    return (
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Analysis Summary</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Document Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize">{documentType.replace('_', ' ')}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Reading Level</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize">{readingLevel}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Extracted Text Length</dt>
                        <dd className="mt-1 text-sm text-gray-900">{extractedTextLength} chars</dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
