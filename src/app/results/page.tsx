'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SummaryCard } from '@/components/SummaryCard';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { Loading } from '@/components/Loading';

function ResultsContent() {
    const searchParams = useSearchParams();

    const documentType = searchParams.get('documentType') || 'unknown';
    const readingLevel = searchParams.get('readingLevel') || 'unknown';
    const extractedTextLength = parseInt(searchParams.get('extractedTextLength') || '0', 10);
    const preview = searchParams.get('preview') || 'No preview available.';

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900">Analysis Results</h2>
                <Link href="/upload" className="text-indigo-600 hover:text-indigo-500 font-medium">
                    &larr; Analyze another
                </Link>
            </div>

            <DisclaimerBanner />

            <SummaryCard
                documentType={documentType}
                readingLevel={readingLevel}
                extractedTextLength={extractedTextLength}
            />

            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Extracted Text Preview
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        First ~300 characters of the document.
                    </p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-200 font-mono">
                        {preview}
                    </pre>
                </div>
            </div>

            <div className="flex justify-center mt-8">
                <Link
                    href="/"
                    className="text-base text-gray-500 hover:text-gray-900"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}

export default function ResultsPage() {
    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<Loading />}>
                <ResultsContent />
            </Suspense>
        </main>
    );
}
