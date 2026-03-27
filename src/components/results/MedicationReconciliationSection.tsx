"use client";

const STATUS_STYLES: Record<string, string> = {
    new: "bg-teal-light text-teal border-teal/30",
    continued: "bg-sage-light text-sage border-sage/30",
    stopped: "bg-gray-100 text-gray-600 border-gray-200",
    dose_changed: "bg-amber-light text-amber border-amber/30",
    unclear: "bg-indigo-50 text-indigo-700 border-indigo-100",
};

export function MedicationReconciliationSection({
    items,
}: {
    items: Array<{ name: string; status: string; note: string }>;
}) {
    if (!items?.length) return null;

    return (
        <section id="med-reconciliation" className="bg-white rounded-2xl p-7 space-y-4 scroll-mt-24 border border-gray-100">
            <div>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Medication reconciliation</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                    How this document describes your medications vs changes. Always confirm with your clinician or pharmacist.
                </p>
            </div>
            <div className="space-y-3">
                {items.map((m, i) => (
                    <div
                        key={i}
                        className={`rounded-xl border px-4 py-3 ${STATUS_STYLES[m.status] ?? STATUS_STYLES.unclear}`}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-semibold text-[15px]">{m.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{m.status.replace("_", " ")}</span>
                        </div>
                        <p className="text-[13px] mt-2 leading-relaxed opacity-95">{m.note}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
