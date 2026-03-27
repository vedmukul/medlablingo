import React from 'react';

export function DiscontinuedMedsCard({ meds }: { meds: any[] }) {
    if (!meds || meds.length === 0) return null;

    return (
        <div className="border rounded-xl p-6 bg-customRed-light/10 border-customRed/20">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-customRed mb-4">Medications to STOP taking</h3>
            <div className="space-y-3">
                {meds.map((med, idx) => (
                    <div key={idx} className="bg-white border border-customRed-light shadow-sm rounded-lg p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-customRed"></div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🚫</span>
                            <span className="font-serif text-lg text-customRed line-through opacity-80 decoration-2">{med.name}</span>
                        </div>
                        <p className="text-[14px] text-gray-700 pl-8 leading-snug mb-2">
                            <span className="font-medium text-gray-900">Why?</span> {med.reasonPlain || med.reason}
                        </p>
                        {med.replacedBy && (
                            <p className="text-[13px] text-navy font-medium pl-8 bg-sand/30 p-2 rounded ml-8 inline-block">
                                ➔ Replaced by: <span className="font-bold">{med.replacedBy}</span>
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
