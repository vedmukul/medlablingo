"use client";

import { useState } from "react";

type Step = {
    id: string;
    question: string;
    detail: string;
};

const STEPS: Step[] = [
    {
        id: "breathing",
        question: "Are you having severe trouble breathing, chest pain, or feeling faint right now?",
        detail: "If yes, treat this as an emergency in your area (e.g. call 911 in the U.S.).",
    },
    {
        id: "neuro",
        question: "Are you having sudden weakness on one side, trouble speaking, confusion, or the worst headache of your life?",
        detail: "If yes, seek emergency care immediately.",
    },
    {
        id: "harm",
        question: "Are you thinking about hurting yourself or someone else?",
        detail: "If yes, in the U.S. call or text 988, or your local crisis line. Elsewhere, contact local emergency services.",
    },
];

export function RedFlagQuiz() {
    const [open, setOpen] = useState(false);
    const [idx, setIdx] = useState(0);
    const [anyYes, setAnyYes] = useState(false);

    const reset = () => {
        setIdx(0);
        setAnyYes(false);
    };

    const step = STEPS[idx];

    return (
        <section id="quick-safety-check" className="rounded-2xl border border-gray-200 bg-white overflow-hidden scroll-mt-24">
            <button
                type="button"
                onClick={() => {
                    setOpen(!open);
                    if (!open) reset();
                }}
                className="w-full text-left px-6 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
            >
                <div>
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Quick safety check</h2>
                    <p className="text-[13px] text-gray-600 mt-1">Optional — 3 yes/no questions. Not a substitute for professional triage.</p>
                </div>
                <span className="text-gray-400 text-lg">{open ? "▴" : "▾"}</span>
            </button>

            {open && (
                <div className="px-6 pb-6 pt-0 border-t border-gray-100">
                    {anyYes ? (
                        <div className="mt-4 rounded-xl bg-customRed-light border border-customRed/30 p-4">
                            <p className="font-semibold text-customRed text-[15px]">Please get help now</p>
                            <p className="text-[14px] text-gray-800 mt-2 leading-relaxed">
                                You indicated something that may be an emergency. Use your local emergency number, go to the nearest
                                emergency department, or follow the crisis resources in the red box above.
                            </p>
                            <button
                                type="button"
                                onClick={reset}
                                className="mt-4 text-[13px] font-semibold text-navy underline"
                            >
                                Start over
                            </button>
                        </div>
                    ) : idx >= STEPS.length ? (
                        <div className="mt-4 rounded-xl bg-sage-light/50 border border-sage/20 p-4">
                            <p className="text-[14px] text-gray-800">
                                You did not indicate those emergency patterns. Still use your doctor&apos;s instructions and the
                                warning signs from your document.
                            </p>
                            <button
                                type="button"
                                onClick={reset}
                                className="mt-3 text-[13px] font-semibold text-teal underline"
                            >
                                Start over
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-4">
                            <p className="text-[15px] text-navy font-medium leading-snug">{step.question}</p>
                            <p className="text-[12px] text-gray-500">{step.detail}</p>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAnyYes(true)}
                                    className="px-5 py-2.5 rounded-lg bg-customRed text-white text-[14px] font-semibold"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIdx((i) => i + 1)}
                                    className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-[14px] font-semibold hover:bg-gray-50"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
