// src/app/upload/page.tsx
"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loading } from "@/components/Loading";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { saveAnalysis } from "@/lib/persistence/analysisStorage";

// Constants
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Progress stages with timings
const PROGRESS_STAGES = [
    { message: "Uploading file...", delay: 0 },
    { message: "Extracting text...", delay: 600 },
    { message: "Analyzing with AI...", delay: 1400 },
    { message: "Generating summary...", delay: 2400 },
];

function UploadForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [file, setFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState("lab_report");
    const [readingLevel, setReadingLevel] = useState("standard");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [progressMessage, setProgressMessage] = useState("");
    const [completedStages, setCompletedStages] = useState<string[]>([]);
    const [requestId, setRequestId] = useState<string | null>(null);

    const progressTimers = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        const typeParam = searchParams.get("documentType");
        if (typeParam) setDocumentType(typeParam);
    }, [searchParams]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            progressTimers.current.forEach(timer => clearTimeout(timer));
        };
    }, []);

    // Validate file type and size
    const validateFile = (file: File): { valid: boolean; error?: string } => {
        if (file.type !== "application/pdf") {
            return {
                valid: false,
                error: "Please upload a PDF file. Other file types are not supported.",
            };
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                error: `PDF must be under ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
            };
        }

        return { valid: true };
    };

    // Handle file selection from input or drop
    const handleFileSelection = (selectedFile: File | null) => {
        if (!selectedFile) {
            setFile(null);
            setError(null);
            return;
        }

        const validation = validateFile(selectedFile);
        if (!validation.valid) {
            setError(validation.error || "Invalid file");
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    // File input change handler
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        handleFileSelection(selectedFile);
    };

    // Drag event handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            handleFileSelection(droppedFile);
        }
    };

    // Remove file handler
    const handleRemoveFile = () => {
        setFile(null);
        setError(null);
    };

    // Start progress simulation
    const startProgressSimulation = () => {
        // Clear any existing timers
        progressTimers.current.forEach(timer => clearTimeout(timer));
        progressTimers.current = [];

        // Set up new progress timers
        PROGRESS_STAGES.forEach((stage, index) => {
            const timer = setTimeout(() => {
                setProgressMessage(stage.message);
            }, stage.delay);
            progressTimers.current.push(timer);
        });
    };

    // Stop progress simulation
    const stopProgressSimulation = () => {
        progressTimers.current.forEach(timer => clearTimeout(timer));
        progressTimers.current = [];
    };

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError("Please select a PDF file.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgressMessage("");
        setCompletedStages([]);
        setRequestId(null);

        // Start progress simulation
        startProgressSimulation();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);
        formData.append("readingLevel", readingLevel);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            // Stop simulated progress
            stopProgressSimulation();

            if (!response.ok || !data?.ok) {
                const msg =
                    data?.error ||
                    "Analysis failed. Please try again with a clearer (text-selectable) PDF.";

                // Extract requestId if present
                if (data?.requestId) {
                    setRequestId(data.requestId);
                }

                throw new Error(msg);
            }

            // Show actual completed stages if available
            if (data.stagesCompleted && Array.isArray(data.stagesCompleted)) {
                setCompletedStages(data.stagesCompleted);
                setProgressMessage("Done!");
            } else {
                setProgressMessage("Done!");
            }

            // Persist entire payload for /results
            saveAnalysis(data);

            // Small delay to show "Done!" message
            await new Promise(resolve => setTimeout(resolve, 500));

            // Navigate (no query params needed)
            router.push("/results");
        } catch (err: any) {
            console.error(err);
            stopProgressSimulation();
            setError(err?.message || "An error occurred.");
            // Keep the file selected so user can retry
        } finally {
            setIsLoading(false);
        }
    };

    // Format file size for display
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loading />
                <div className="mt-6 text-center max-w-md">
                    {progressMessage && (
                        <p className="text-lg font-medium text-accent mb-4">
                            {progressMessage}
                        </p>
                    )}

                    {completedStages.length > 0 && (
                        <div className="mt-4 bg-status-normal-bg border border-status-normal/30 rounded-card p-4">
                            <p className="text-sm font-medium text-status-normal mb-2">
                                Completed Stages:
                            </p>
                            <ul className="text-xs text-status-normal space-y-1">
                                {completedStages.map((stage, index) => (
                                    <li key={index} className="flex items-center">
                                        <svg className="h-4 w-4 mr-2 text-status-normal" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        {stage}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!completedStages.length && (
                        <p className="text-sm text-text-secondary">
                            This may take a few moments...
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface-card py-8 px-4 shadow-card sm:rounded-card sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="bg-status-critical-bg border-l-4 border-status-critical p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-5 w-5 text-status-critical"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm text-status-critical">{error}</p>
                                {requestId && (
                                    <p className="text-xs text-status-critical mt-1">
                                        Request ID: <code className="bg-status-critical-bg px-1 rounded">{requestId}</code>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label
                        htmlFor="documentType"
                        className="block text-sm font-medium text-text-primary"
                    >
                        Document Type
                    </label>
                    <select
                        id="documentType"
                        name="documentType"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-accent-muted focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-card"
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                    >
                        <option value="lab_report">Lab Report</option>
                        <option value="discharge_instructions">
                            Discharge Instructions
                        </option>
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="readingLevel"
                        className="block text-sm font-medium text-text-primary"
                    >
                        Reading Level
                    </label>
                    <select
                        id="readingLevel"
                        name="readingLevel"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-accent-muted focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-card"
                        value={readingLevel}
                        onChange={(e) => setReadingLevel(e.target.value)}
                    >
                        <option value="standard">Standard</option>
                        <option value="simple">Simple (5th Grade)</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="file" className="block text-sm font-medium text-text-primary">
                        Upload PDF
                    </label>
                    <div
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-card transition-all ${isDragOver
                                ? "border-accent bg-accent-light"
                                : "border-accent-muted hover:border-accent"
                            } ${file ? "bg-status-normal-bg border-status-normal" : ""}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        tabIndex={0}
                        role="button"
                        aria-label="File upload dropzone"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                document.getElementById("file-upload")?.click();
                            }
                        }}
                    >
                        <div className="space-y-1 text-center w-full">
                            {!file ? (
                                <>
                                    <svg
                                        className="mx-auto h-12 w-12 text-text-muted"
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
                                    <div className="flex text-sm text-text-secondary justify-center">
                                        <label
                                            htmlFor="file-upload"
                                            className="relative cursor-pointer bg-surface-card rounded-md font-medium text-accent hover:text-accent-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent"
                                        >
                                            <span>Choose a PDF file</span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                accept=".pdf"
                                                className="sr-only"
                                                onChange={handleFileInputChange}
                                            />
                                        </label>
                                        <p className="pl-1">or drag and drop here</p>
                                    </div>
                                    <p className="text-xs text-text-muted">
                                        PDF files up to {MAX_FILE_SIZE_MB}MB
                                    </p>
                                </>
                            ) : (
                                <div className="py-2">
                                    <svg
                                        className="mx-auto h-12 w-12 text-status-normal"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <p className="text-sm font-semibold text-status-normal mt-2">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-status-normal mt-1">
                                        {formatFileSize(file.size)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="mt-3 inline-flex items-center px-3 py-1.5 border border-status-critical/30 text-xs font-medium rounded text-status-critical bg-surface-card hover:bg-status-critical-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-status-critical"
                                    >
                                        <svg
                                            className="h-4 w-4 mr-1"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                        Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={!file || isLoading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-card shadow-card text-sm font-medium text-text-inverse bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? "Processing..." : "Analyze My Document"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function UploadPage() {
    return (
        <main className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-heading font-semibold text-text-primary">
                        Upload your document
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                        We&apos;ll analyze it and provide a clear summary.
                    </p>
                </div>

                <DisclaimerBanner />

                {/* Privacy & Safety Notice */}
                <div className="bg-accent-light border-l-4 border-accent p-4 mb-6">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-5 w-5 text-accent"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-accent-dark">Privacy & Safety</h3>
                            <div className="mt-2 text-xs text-text-primary">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Analysis stored locally for <strong>24 hours</strong></li>
                                    <li>Text is <strong>redacted</strong> before analysis (removes emails, phone numbers, etc.)</li>
                                    <li>No full document text stored in your browser</li>
                                    <li>Click &quot;Clear saved&quot; anytime to delete</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <Suspense fallback={<Loading />}>
                    <UploadForm />
                </Suspense>
            </div>
        </main>
    );
}
