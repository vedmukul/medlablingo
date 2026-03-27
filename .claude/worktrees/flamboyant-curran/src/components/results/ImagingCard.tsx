import React from 'react';

export function ImagingCard({ items }: { items: any[] }) {
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 ml-1">Imaging & Procedures</h3>
            {items.map((item, idx) => (
                <div key={idx} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                        <h4 className="font-serif text-lg text-navy leading-tight">{item.name}</h4>
                        {item.date && (
                            <span className="text-[12px] font-bold uppercase tracking-wider text-sage bg-sage-light/50 px-2 py-1 rounded">
                                {item.date}
                            </span>
                        )}
                    </div>

                    <p className="text-[14px] leading-relaxed text-gray-600 mb-4 pb-4 border-b border-gray-100">
                        {item.findingsPlain || item.findings}
                    </p>

                    {item.keyValues && item.keyValues.length > 0 && (
                        <div className="space-y-3">
                            <h5 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Key Measurements</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {item.keyValues.map((kv: any, kvIdx: number) => (
                                    <div key={kvIdx} className="bg-sand/30 p-3 rounded-lg border border-sand-dark/30">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-[13px] font-medium text-gray-600">{kv.label}</span>
                                            <span className="text-[15px] font-bold text-navy">{kv.value}</span>
                                        </div>
                                        <div className="text-[12px] text-gray-500 leading-snug">{kv.interpretation}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
