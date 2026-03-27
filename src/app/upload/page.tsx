// src/app/upload/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Shield } from "lucide-react";
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

    const [file, setFile] = useState<File | null>(null);
    /** Always auto — the model classifies the PDF (no manual document-type UI). */
    const documentType = "auto";
    const [readingLevel, setReadingLevel] = useState("standard");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [progressMessage, setProgressMessage] = useState("");
    const [completedStages, setCompletedStages] = useState<string[]>([]);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [pdfPreview, setPdfPreview] = useState<
        | null
        | "loading"
        | { charCount: number; quality: string; warnings: string[] }
    >(null);

    const progressTimers = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        if (!file) {
            setPdfPreview(null);
            return;
        }
        const ac = new AbortController();
        const timer = setTimeout(async () => {
            setPdfPreview("loading");
            const fd = new FormData();
            fd.append("file", file);
            try {
                const res = await fetch("/api/extract-preview", {
                    method: "POST",
                    body: fd,
                    signal: ac.signal,
                });
                const j = await res.json().catch(() => null);
                if (ac.signal.aborted) return;
                if (j?.ok) {
                    setPdfPreview({
                        charCount: j.charCount,
                        quality: j.quality,
                        warnings: Array.isArray(j.warnings) ? j.warnings : [],
                    });
                } else {
                    setPdfPreview({
                        charCount: 0,
                        quality: "empty",
                        warnings: [j?.hint || j?.error || "Could not preview this PDF."],
                    });
                }
            } catch {
                if (!ac.signal.aborted) setPdfPreview(null);
            }
        }, 450);
        return () => {
            clearTimeout(timer);
            ac.abort();
        };
    }, [file]);

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
                        <p className="text-lg font-medium text-navy mb-4">
                            {progressMessage}
                        </p>
                    )}

                    {completedStages.length > 0 && (
                        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-green-900 mb-2">
                                Completed Stages:
                            </p>
                            <ul className="text-xs text-green-800 space-y-1">
                                {completedStages.map((stage, index) => (
                                    <li key={index} className="flex items-center">
                                        <svg className="h-4 w-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        {stage}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!completedStages.length && (
                        <p className="text-sm text-gray-500">
                            This may take a few moments...
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white py-8 px-4 sm:px-10 rounded-2xl border border-gray-100 shadow-sm">
            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-5 w-5 text-red-400"
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
                                <p className="text-sm text-red-700">{error}</p>
                                {requestId && (
                                    <p className="text-xs text-red-600 mt-1">
                                        Request ID: <code className="bg-red-100 px-1 rounded">{requestId}</code>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="rounded-xl border border-gray-100 bg-warmBase/40 px-4 py-3 text-sm text-gray-700">
                    <p className="font-medium text-navy mb-2">What you can upload</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                        <li>Lab reports, blood work, and pathology results</li>
                        <li>Discharge instructions and home-care summaries</li>
                        <li>Full hospital discharge summaries (labs + medications + follow-up)</li>
                    </ul>
                    <p className="mt-3 text-gray-600 leading-relaxed">
                        You do not need to pick a type — we read your PDF and tailor the summary to what is in the document.
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="readingLevel"
                        className="block text-sm font-medium text-gray-700"
                    >
                        Reading Level
                    </label>
                    <select
                        id="readingLevel"
                        name="readingLevel"
                        className="mt-1 block w-full min-h-[44px] pl-3 pr-10 py-2 text-base border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy/20 sm:text-sm"
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
                    <div
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-navy/35 focus-visible:ring-offset-2 ${
                            isDragOver
                                ? "border-teal bg-teal-light/40"
                                : "border-gray-300 hover:border-teal/50"
                        } ${file ? "bg-green-50 border-green-400" : "bg-warmBase/50"}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        tabIndex={0}
                        role="button"
                        aria-label="Upload PDF: drop a file here or press Enter to choose"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                document.getElementById("file-upload")?.click();
                            }
                        }}
                    >
                        <div className="space-y-1 text-center w-full">
                            {!file ? (
                                <>
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
                                    <p className="text-sm text-gray-600 text-center px-2 leading-normal max-w-full">
                                        <label
                                            htmlFor="file-upload"
                                            className="relative cursor-pointer inline font-medium text-navy hover:text-teal px-1.5 py-0.5 rounded-md motion-safe:transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-navy/35 focus-within:ring-offset-2"
                                        >
                                            <span>Upload a file</span>
                                            <input
                                                id="file-upload"
                                                name="file-upload"
                                                type="file"
                                                accept=".pdf"
                                                className="sr-only"
                                                onChange={handleFileInputChange}
                                            />
                                        </label>
                                        <span className="text-gray-600">{" "}or drag and drop</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        PDF up to {MAX_FILE_SIZE_MB}MB
                                    </p>
                                </>
                            ) : (
                                <div className="py-2">
                                    <svg
                                        className="mx-auto h-12 w-12 text-green-500"
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
                                    <p className="text-sm font-semibold text-green-700 mt-2">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                        {formatFileSize(file.size)}
                                    </p>
                                    {pdfPreview === "loading" && (
                                        <p className="text-xs text-teal font-medium mt-3">Checking whether text can be read from your PDF…</p>
                                    )}
                                    {pdfPreview && pdfPreview !== "loading" && (
                                        <div
                                            className={`mt-3 text-left rounded-lg border px-3 py-2 text-xs ${
                                                pdfPreview.quality === "ok"
                                                    ? "bg-green-50 border-green-200 text-green-900"
                                                    : pdfPreview.quality === "low"
                                                      ? "bg-amber-50 border-amber-200 text-amber-900"
                                                      : "bg-red-50 border-red-200 text-red-900"
                                            }`}
                                        >
                                            <p className="font-semibold">
                                                {pdfPreview.quality === "ok" && "Text looks readable for analysis"}
                                                {pdfPreview.quality === "low" && "Low text — results may be unreliable"}
                                                {pdfPreview.quality === "empty" && "No text detected — analysis will likely fail"}
                                            </p>
                                            <p className="mt-1 opacity-90">~{pdfPreview.charCount.toLocaleString()} characters found</p>
                                            {pdfPreview.warnings.map((w, i) => (
                                                <p key={i} className="mt-1 leading-snug">
                                                    {w}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="mt-3 inline-flex items-center min-h-[40px] px-3 py-2 border border-red-300 text-xs font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400"
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
                        className="w-full min-h-[48px] flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-[15px] font-semibold text-white bg-navy hover:bg-navy-light motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy/45 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileUp className="w-5 h-5 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
                        {isLoading ? "Processing..." : "Analyze Document"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function UploadPage() {
    return (
        <main className="min-h-dvh bg-warmBase py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8 space-y-3">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-sage">Analyze your document</p>
                    <h1 className="text-3xl sm:text-4xl font-serif font-bold text-navy leading-tight">
                        Upload a PDF
                    </h1>
                    <p className="text-[15px] text-gray-600 max-w-md mx-auto leading-relaxed">
                        Choose the document type, add your file, and we&apos;ll return a plain-language summary.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[13px]">
                        <Link
                            href="/"
                            className="text-teal font-semibold hover:text-navy motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/35 focus-visible:rounded"
                        >
                            ← Home
                        </Link>
                        <Link
                            href="/history"
                            className="text-gray-500 hover:text-navy motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/35 focus-visible:rounded"
                        >
                            History &amp; trends
                        </Link>
                    </div>
                </div>

                <DisclaimerBanner />

                <div className="rounded-xl border border-teal/20 bg-teal-light/40 p-4 mb-6 flex gap-3">
                    <Shield className="w-5 h-5 shrink-0 text-teal mt-0.5" strokeWidth={1.75} aria-hidden />
                    <div>
                        <h2 className="text-sm font-semibold text-navy">Privacy &amp; safety</h2>
                        <ul className="mt-2 text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                            <li>Analysis summary kept on this device for about <strong>24 hours</strong></li>
                            <li>Sensitive patterns are <strong>redacted</strong> before the AI sees your text</li>
                            <li>We don&apos;t store the full PDF text in your browser long-term</li>
                            <li>Use &quot;Clear data&quot; on results when you want to remove saved summaries</li>
                        </ul>
                    </div>
                </div>

                <UploadForm />
            </div>
        </main>
    );
}