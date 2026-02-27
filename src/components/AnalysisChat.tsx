"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import React from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface AnalysisChatProps {
    result: unknown;
    suggestedQuestions?: string[];
}

export function AnalysisChat({ result, suggestedQuestions = [] }: AnalysisChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I can answer questions about your analysis. What would you like to know?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    async function sendMessage(text: string) {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = { role: "user", content: trimmed };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: updatedMessages,
                    analysisResult: result,
                }),
            });

            const data = await res.json();

            if (!data.ok || !data.reply) {
                setError(data.error || "Something went wrong. Please try again.");
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.reply },
                ]);
            }
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        sendMessage(input);
    }

    // Show only first 4 suggested questions that haven't been asked yet
    const shownSuggestions = suggestedQuestions
        .filter((q) => !messages.some((m) => m.content === q))
        .slice(0, 4);

    function renderMarkdown(text: string): React.ReactNode {
        const lines = text.split("\n");
        const elements: React.ReactNode[] = [];
        let listItems: string[] = [];

        function flushList() {
            if (listItems.length === 0) return;
            elements.push(
                <ol key={`ol-${elements.length}`} className="list-decimal ml-5 my-1 space-y-0.5">
                    {listItems.map((item, j) => (
                        <li key={j}>{formatInline(item)}</li>
                    ))}
                </ol>
            );
            listItems = [];
        }

        function formatInline(str: string): React.ReactNode {
            const parts: React.ReactNode[] = [];
            const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
            let last = 0;
            let match;
            let idx = 0;
            while ((match = regex.exec(str)) !== null) {
                if (match.index > last) {
                    parts.push(str.slice(last, match.index));
                }
                if (match[2]) {
                    parts.push(<strong key={idx++}>{match[2]}</strong>);
                } else if (match[3]) {
                    parts.push(<em key={idx++}>{match[3]}</em>);
                }
                last = regex.lastIndex;
            }
            if (last < str.length) parts.push(str.slice(last));
            return parts.length === 1 ? parts[0] : <>{parts}</>;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
            const bulletMatch = line.match(/^\s*[-•]\s+(.*)/);

            if (numberedMatch) {
                listItems.push(numberedMatch[2]);
            } else if (bulletMatch) {
                listItems.push(bulletMatch[1]);
            } else {
                flushList();
                if (line.trim() === "") {
                    if (elements.length > 0) elements.push(<br key={`br-${i}`} />);
                } else {
                    elements.push(<p key={`p-${i}`} className="my-0.5">{formatInline(line)}</p>);
                }
            }
        }
        flushList();

        return <>{elements}</>;
    }

    return (
        <section className="border-0 overflow-hidden flex flex-col h-full bg-warmWhite">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="font-semibold text-navy text-base font-serif">Understand Your Results</h2>
                    <p className="text-xs text-gray-500 mt-1">Educational only — not medical advice</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-sand rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-gray-200">
                    Ask questions about your analysis results. Responses are educational and should be discussed with your healthcare provider.
                </div>

                {messages.map((msg, i) => {
                    // Skip the default first message since we have the intro card above
                    if (i === 0 && msg.role === 'assistant' && msg.content.includes("What would you like to know?")) return null;

                    return (
                        <div
                            key={i}
                            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                            <span className="text-xs text-gray-400 mb-1 font-medium">{msg.role === "user" ? "You" : "MedLabLingo"}</span>
                            <div
                                className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-navy text-white"
                                    : "bg-white text-navy border border-gray-200 shadow-sm"
                                    }`}
                            >
                                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                            </div>
                        </div>
                    )
                })}

                {/* Typing indicator */}
                {isLoading && (
                    <div className="flex flex-col items-start">
                        <span className="text-xs text-gray-400 mb-1 font-medium">MedLabLingo</span>
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                            <span className="flex gap-1.5 items-center h-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex justify-center">
                        <p className="text-xs text-customRed bg-red-light border border-customRed rounded px-3 py-1">
                            {error}
                        </p>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Suggested question chips */}
            {shownSuggestions.length > 0 && (
                <div className="px-6 py-4 bg-warmWhite">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Common Questions</p>
                    <div className="flex flex-col gap-2">
                        {shownSuggestions.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(q)}
                                disabled={isLoading}
                                className="text-left text-[13px] text-navy bg-white border border-gray-200 rounded-lg px-4 py-3 hover:bg-sand hover:border-gray-300 transition-colors disabled:opacity-50"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input bar */}
            <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white flex items-center gap-2 px-6 py-4">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your results..."
                    disabled={isLoading}
                    maxLength={1000}
                    className="flex-1 text-sm px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-navy focus:border-navy disabled:bg-gray-50 placeholder-gray-400 text-navy"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-5 py-2 rounded-lg bg-navy text-white hover:bg-navy-light disabled:opacity-40 transition-colors font-medium text-sm flex-shrink-0"
                >
                    Ask
                </button>
            </form>
        </section>
    );
}
