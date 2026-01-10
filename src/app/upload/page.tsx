'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loading } from '@/components/Loading';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

function UploadForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [file, setFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState('lab_report');
    const [readingLevel, setReadingLevel] = useState('standard');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const typeParam = searchParams.get('documentType');
        if (typeParam) {
            setDocumentType(typeParam);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a PDF file.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        formData.append('readingLevel', readingLevel);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Analysis failed. Please try again.');
            }

            const data = await response.json();

            // Navigate to results with query params
            const params = new URLSearchParams();
            params.append('documentType', documentType);
            params.append('readingLevel', readingLevel);
            if (data.extractedTextLength) params.append('extractedTextLength', data.extractedTextLength.toString());
            if (data.preview) params.append('preview', data.preview);

            router.push(`/results?${params.toString()}`);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loading />
                <p className="mt-4 text-gray-500">Processing your document...</p>
            </div>
        );
    }

    return (
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">
                        Document Type
                    </label>
                    <select
                        id="documentType"
                        name="documentType"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                    >
                        <option value="lab_report">Lab Report</option>
                        <option value="discharge_instructions">Discharge Instructions</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="readingLevel" className="block text-sm font-medium text-gray-700">
                        Reading Level
                    </label>
                    <select
                        id="readingLevel"
                        name="readingLevel"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={readingLevel}
                        onChange={(e) => setReadingLevel(e.target.value)}
                    >
                        <option value="standard">Standard</option>
                        <option value="simple">Simple (5th Grade)</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                        Upload PDF
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-500 transition-colors">
                        <div className="space-y-1 text-center">
                            <svg
                                className="mx-auto h-12 w-12 text-gray-400"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 48 48"
                                aria-hidden="true"
                            >
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                                <label
                                    htmlFor="file-upload"
                                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                                >
                                    <span>Upload a file</span>
                                    <input
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        accept=".pdf"
                                        className="sr-only"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PDF up to 10MB</p>
                            {file && (
                                <p className="text-sm text-green-600 font-semibold mt-2">Selected: {file.name}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={!file || isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Processing...' : 'Analyze Document'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function UploadPage() {
    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-extrabold text-gray-900">Upload your document</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        We&apos;ll analyze it and provide a clear summary.
                    </p>
                </div>

                <DisclaimerBanner />

                <Suspense fallback={<Loading />}>
                    <UploadForm />
                </Suspense>
            </div>
        </main>
    );
}
