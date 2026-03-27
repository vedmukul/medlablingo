"use client";

import { useState } from "react";

const LANGUAGES = [
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "zh", label: "中文" },
    { code: "hi", label: "हिन्दी" },
    { code: "ar", label: "العربية" },
    { code: "pt", label: "Português" },
    { code: "ru", label: "Русский" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "tl", label: "Tagalog" },
    { code: "pa", label: "ਪੰਜਾਬੀ" },
    { code: "bn", label: "বাংলা" },
    { code: "ur", label: "اردو" },
] as const;

interface TranslateButtonProps {
    result: any;
    onTranslated: (translated: any, langCode: string, langLabel: string) => void;
    onReset: () => void;
    activeLanguage: string | null;
}

export function TranslateButton({ result, onTranslated, onReset, activeLanguage }: TranslateButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleTranslate(langCode: string, langLabel: string) {
        setIsOpen(false);
        setError(null);

        if (langCode === activeLanguage) {
            onReset();
            return;
        }

        setIsLoading(true);

        const texts: Record<string, unknown> = {};

        if (result.patientSummary?.overallSummary) {
            texts.overallSummary = result.patientSummary.overallSummary;
        }
        if (Array.isArray(result.patientSummary?.keyTakeaways)) {
            texts.keyTakeaways = result.patientSummary.keyTakeaways;
        }
        if (Array.isArray(result.questionsForDoctor)) {
            texts.questionsForDoctor = result.questionsForDoctor;
        }
        if (Array.isArray(result.whatWeCouldNotDetermine)) {
            texts.whatWeCouldNotDetermine = result.whatWeCouldNotDetermine;
        }
        if (result.labsSection) {
            if (result.labsSection.overallLabNote) {
                texts.overallLabNote = result.labsSection.overallLabNote;
            }
            if (Array.isArray(result.labsSection.labs)) {
                texts.labExplanations = result.labsSection.labs.map(
                    (l: any) => ({ name: l.name, explanation: l.explanation })
                );
            }
        }
        if (result.dischargeSection) {
            const dc = result.dischargeSection;
            if (Array.isArray(dc.homeCareSteps)) texts.homeCareSteps = dc.homeCareSteps;
            if (Array.isArray(dc.followUp)) texts.followUp = dc.followUp;
            if (Array.isArray(dc.warningSignsFromDoc)) {
                texts.warningSignsFromDoc = dc.warningSignsFromDoc.map((ws: any) => ({
                    symptom: ws.symptom,
                    action: ws.action,
                }));
            }
            if (Array.isArray(dc.generalRedFlags)) texts.generalRedFlags = dc.generalRedFlags;
            if (Array.isArray(dc.diagnosesMentionedInDoc)) texts.diagnosesMentionedInDoc = dc.diagnosesMentionedInDoc;
            if (Array.isArray(dc.medications)) {
                texts.medications = dc.medications.map((m: any) => ({
                    name: m.name,
                    purposePlain: m.purposePlain,
                    howToTakeFromDoc: m.howToTakeFromDoc,
                    cautionsGeneral: m.cautionsGeneral,
                }));
            }
        }

        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts, targetLanguage: langCode }),
            });

            const data = await res.json();

            if (!data.ok) {
                setError(data.error || "Translation failed.");
                return;
            }

            onTranslated(data.translated, langCode, langLabel);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M7.75 2.75a.75.75 0 0 0-1.5 0v1.258a32.987 32.987 0 0 0-3.599.278.75.75 0 1 0 .198 1.487A31.545 31.545 0 0 1 8.7 5.545 19.381 19.381 0 0 1 7.257 9.04a19.418 19.418 0 0 1-1.416-2.13.75.75 0 0 0-1.32.716 20.898 20.898 0 0 0 1.987 2.862 19.474 19.474 0 0 1-3.596 2.852.75.75 0 0 0 .848 1.235 20.964 20.964 0 0 0 3.994-3.19 20.964 20.964 0 0 0 3.09 2.37.75.75 0 1 0 .836-1.245 19.479 19.479 0 0 1-2.748-2.118 20.898 20.898 0 0 0 2.05-3.71.75.75 0 1 0-1.36-.632A19.381 19.381 0 0 1 8.7 7.545V2.75Z" />
                        <path d="M12.75 12a.75.75 0 0 1 .694.468l3.25 7.75a.75.75 0 0 1-1.388.564l-.806-1.92H11.5l-.806 1.92a.75.75 0 0 1-1.388-.564l3.25-7.75A.75.75 0 0 1 12.75 12Zm-1.25 5.112h2.5l-1.25-2.98-1.25 2.98Z" />
                    </svg>
                    {isLoading ? "Translating..." : activeLanguage ? `Translated` : "Translate"}
                </button>

                {activeLanguage && (
                    <button
                        onClick={onReset}
                        className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Show English
                    </button>
                )}
            </div>

            {error && (
                <p className="absolute top-full mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 whitespace-nowrap z-10">
                    {error}
                </p>
            )}

            {isOpen && (
                <div className="absolute top-full mt-1 right-0 bg-white border rounded-lg shadow-lg z-20 w-48 max-h-64 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleTranslate(lang.code, lang.label)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${activeLanguage === lang.code ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
}
