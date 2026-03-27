// src/components/results/CollapsibleSection.tsx
"use client";
import React, { useState } from "react";

interface CollapsibleSectionProps {
    id?: string;
    title: string;
    icon?: string;
    count?: number;
    preview?: string;
    accentColor?: string; // Tailwind border color class e.g. "border-teal"
    defaultOpen?: boolean;
    urgentCount?: number;
    children: React.ReactNode;
}

/**
 * Reusable collapsible section with smooth expand/collapse animation.
 * Uses CSS grid-template-rows trick for animating height from 0 to auto.
 */
export function CollapsibleSection({
    id,
    title,
    icon,
    count,
    preview,
    accentColor = "border-gray-200",
    defaultOpen = false,
    urgentCount,
    children,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section
            id={id}
            className={`rounded-xl border-l-[3px] ${accentColor} bg-white scroll-mt-24 transition-shadow ${open ? "shadow-sm" : "shadow-none hover:shadow-sm"}`}
        >
            {/* Header — always visible, clickable */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left group"
                aria-expanded={open}
                aria-controls={id ? `${id}-content` : undefined}
            >
                {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-navy truncate">
                            {title}
                        </h3>
                        {count !== undefined && (
                            <span className="text-[12px] text-gray-400 font-medium">
                                ({count})
                            </span>
                        )}
                        {urgentCount !== undefined && urgentCount > 0 && (
                            <span className="text-[11px] font-bold text-amber bg-amber-light px-1.5 py-0.5 rounded">
                                {urgentCount} urgent
                            </span>
                        )}
                    </div>
                    {!open && preview && (
                        <p className="text-[13px] text-gray-400 truncate mt-0.5">
                            {preview}
                        </p>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Content — animated expand/collapse */}
            <div
                id={id ? `${id}-content` : undefined}
                className="grid transition-all duration-250 ease-out"
                style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1">
                        {children}
                    </div>
                </div>
            </div>
        </section>
    );
}
