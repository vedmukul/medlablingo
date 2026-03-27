"use client";

import { useState, useRef, useEffect } from "react";

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

    return (
        <section className="border rounded-lg overflow-hidden flex flex-col" style={{ height: "480px" }}>
            {/* Header */}
            <div className="px-4 py-3 border-b bg-indigo-50 flex items-center gap-2">
                <span className="text-lg">💬</span>
                <div>
                    <h2 className="font-semibold text-indigo-900 text-sm">Ask about your results</h2>
                    <p className="text-xs text-indigo-600">Educational only — not medical advice</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-indigo-600 text-white rounded-br-sm"
                                    : "bg-white text-gray-800 border rounded-bl-sm shadow-sm"
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm">
                            <span className="flex gap-1 items-center">
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex justify-center">
                        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-1">
                            {error}
                        </p>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Suggested question chips */}
            {shownSuggestions.length > 0 && (
                <div className="px-3 py-2 border-t bg-white flex gap-2 flex-wrap">
                    {shownSuggestions.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(q)}
                            disabled={isLoading}
                            className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 hover:bg-indigo-100 transition-colors disabled:opacity-50 truncate max-w-[200px]"
                            title={q}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}

            {/* Input bar */}
            <form onSubmit={handleSubmit} className="border-t bg-white flex items-center gap-2 px-3 py-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about your results…"
                    disabled={isLoading}
                    maxLength={1000}
                    className="flex-1 text-sm px-3 py-2 border rounded-full outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
                    aria-label="Send"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.338H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.338a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.208-7.324.75.75 0 0 0 0-1.122A28.897 28.897 0 0 0 3.105 2.288Z" />
                    </svg>
                </button>
            </form>
        </section>
    );
}
