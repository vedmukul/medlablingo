"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Stethoscope, Sun } from "lucide-react";

const STORAGE_KEY = "medlablingo-care-phone-notes";

type WhoSlot = { role: string; detail?: string; phoneHint?: string; whenToCall?: string };

type CareNav = {
    doToday?: string[];
    doThisWeek?: string[];
    beforeNextAppointment?: string[];
    whoToCall?: WhoSlot[];
};

function loadPhones(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, string>;
    } catch {
        return {};
    }
}

function savePhones(map: Record<string, string>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

export function CareNavigationPanel({ careNavigation }: { careNavigation: CareNav }) {
    const [phones, setPhones] = useState<Record<string, string>>({});

    useEffect(() => {
        setPhones(loadPhones());
    }, [careNavigation]);

    const hasAny =
        (careNavigation.doToday?.length ?? 0) > 0 ||
        (careNavigation.doThisWeek?.length ?? 0) > 0 ||
        (careNavigation.beforeNextAppointment?.length ?? 0) > 0 ||
        (careNavigation.whoToCall?.length ?? 0) > 0;

    if (!hasAny) return null;

    const updatePhone = (roleKey: string, value: string) => {
        const next = { ...phones, [roleKey]: value };
        setPhones(next);
        savePhones(next);
    };

    const Section = ({
        title,
        icon,
        items,
        accent,
    }: {
        title: string;
        icon: ReactNode;
        items: string[];
        accent: string;
    }) =>
        items.length === 0 ? null : (
            <div className="rounded-xl border border-gray-100 bg-warmBase/40 p-4">
                <h3 className={`text-[11px] font-bold uppercase tracking-widest ${accent} mb-2 flex items-center gap-2`}>
                    <span className="flex items-center justify-center text-current" aria-hidden>
                        {icon}
                    </span>
                    {title}
                </h3>
                <ul className="space-y-2">
                    {items.map((t, i) => (
                        <li key={i} className="flex gap-2 text-[14px] text-gray-700">
                            <span className="text-teal font-bold">{i + 1}.</span>
                            <span className="leading-relaxed">{t}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );

    return (
        <section id="care-navigation" className="bg-white rounded-2xl p-7 space-y-5 scroll-mt-24 border border-gray-100">
            <div>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Care navigation</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                    Practical next steps from your document. Add phone numbers you use — they stay only on this device.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Section
                    title="Today"
                    icon={<Sun className="w-4 h-4" strokeWidth={1.75} />}
                    items={careNavigation.doToday ?? []}
                    accent="text-navy"
                />
                <Section
                    title="This week"
                    icon={<CalendarDays className="w-4 h-4" strokeWidth={1.75} />}
                    items={careNavigation.doThisWeek ?? []}
                    accent="text-teal"
                />
                <Section
                    title="Before your next appointment"
                    icon={<Stethoscope className="w-4 h-4" strokeWidth={1.75} />}
                    items={careNavigation.beforeNextAppointment ?? []}
                    accent="text-sage"
                />
            </div>

            {careNavigation.whoToCall && careNavigation.whoToCall.length > 0 && (
                <div className="rounded-xl border border-teal/20 bg-teal-light/30 p-4 space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-teal">Who to call</h3>
                    <div className="space-y-4">
                        {careNavigation.whoToCall.map((w, i) => {
                            const key = `${w.role}-${i}`;
                            return (
                                <div key={key} className="bg-white rounded-lg p-4 border border-gray-100">
                                    <p className="font-semibold text-navy text-[15px]">{w.role}</p>
                                    {w.detail && <p className="text-[13px] text-gray-500 mt-0.5">{w.detail}</p>}
                                    {w.whenToCall && (
                                        <p className="text-[12px] text-gray-400 mt-1">
                                            <span className="font-medium text-gray-500">When:</span> {w.whenToCall}
                                        </p>
                                    )}
                                    <label className="block mt-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        Phone / nurse line (stored on this device)
                                    </label>
                                    <input
                                        type="tel"
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-navy"
                                        placeholder={w.phoneHint || "Add number from your paperwork"}
                                        value={phones[key] ?? ""}
                                        onChange={(e) => updatePhone(key, e.target.value)}
                                        autoComplete="tel"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
