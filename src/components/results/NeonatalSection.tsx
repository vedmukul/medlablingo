import React from 'react';

export function NeonatalSection({ feedingPlan, safeSleep, development, birthHistory }: any) {
    if (!feedingPlan && !safeSleep && !development && !birthHistory) return null;

    return (
        <div className="bg-[#f0f4f8] border border-[#d9e2ec] rounded-2xl p-6 shadow-sm overflow-hidden relative">
            {/* Soft decorative background element */}
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <svg className="w-24 h-24 text-[#334e68]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z" /></svg>
            </div>

            <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#627d98] mb-6 flex items-center gap-2 relative z-10">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Neonatal & Pediatric Guidance
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {birthHistory && (
                    <div className="md:col-span-2 bg-white/60 p-5 rounded-xl border border-white">
                        <h4 className="font-serif text-[17px] text-[#243b53] mb-2">Birth History</h4>
                        <p className="text-[14px] text-[#486581] leading-relaxed">{birthHistory}</p>
                    </div>
                )}

                {feedingPlan && (
                    <div className="bg-white/80 p-5 rounded-xl border border-white shadow-sm">
                        <h4 className="font-serif text-[17px] text-[#243b53] mb-2 flex items-center gap-2">
                            <span>🍼</span> Feeding Plan
                        </h4>
                        <p className="text-[14px] text-[#486581] leading-relaxed whitespace-pre-line">{feedingPlan}</p>
                    </div>
                )}

                {safeSleep && (
                    <div className="bg-white/80 p-5 rounded-xl border border-white shadow-sm border-l-4 border-l-[#3eafff]">
                        <h4 className="font-serif text-[17px] text-[#243b53] mb-2 flex items-center gap-2">
                            <span>🛌</span> Safe Sleep Instructions
                        </h4>
                        <p className="text-[14px] text-[#486581] leading-relaxed whitespace-pre-line">{safeSleep}</p>
                    </div>
                )}

                {development && (
                    <div className="md:col-span-2 bg-white/60 p-5 rounded-xl border border-white">
                        <h4 className="font-serif text-[17px] text-[#243b53] mb-2">Developmental Guidance</h4>
                        <p className="text-[14px] text-[#486581] leading-relaxed">{development}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
