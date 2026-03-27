import React from 'react';

export function DailyMonitoring({ monitoring }: { monitoring: string[] }) {
    if (!monitoring || monitoring.length === 0) return null;

    return (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-navy"></span> Daily Monitoring Check
            </h3>
            <div className="space-y-3">
                {monitoring.map((item, idx) => (
                    <label key={idx} className="flex gap-3 items-start p-3 bg-sand/20 rounded-lg outline outline-1 outline-sand-dark/50 cursor-pointer hover:bg-sand/40 transition-colors">
                        <input type="checkbox" className="mt-1 w-4 h-4 rounded text-navy border-gray-300 focus:ring-navy" />
                        <span className="text-[14px] text-navy font-medium leading-relaxed select-none">{item}</span>
                    </label>
                ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-4 text-center italic">Check off tasks as you complete them each day.</p>
        </div>
    );
}
