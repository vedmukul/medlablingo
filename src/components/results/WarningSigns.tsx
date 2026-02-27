import React from 'react';

export function WarningSigns({ signs }: { signs: string[] }) {
    if (!signs || signs.length === 0) return null;

    return (
        <div className="bg-customRed-light/30 border border-customRed/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-customRed text-white flex items-center justify-center font-bold text-lg">!</div>
                <h3 className="font-serif text-xl text-customRed">Warning Signs to Watch For</h3>
            </div>
            <ul className="space-y-3 pt-2">
                {signs.map((sign, idx) => (
                    <li key={idx} className="flex gap-3 text-customRed/90 items-start bg-white/60 p-3 rounded-lg border border-customRed/10">
                        <span className="shrink-0 mt-0.5">•</span>
                        <span className="leading-snug">{sign}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
