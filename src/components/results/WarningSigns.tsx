import React from 'react';

type WarningSignType = {
    symptom: string;
    action: string;
};

export function WarningSigns({ signs }: { signs: WarningSignType[] }) {
    if (!signs || signs.length === 0) return null;

    return (
        <div className="bg-customRed-light/30 border border-customRed/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-customRed text-white flex items-center justify-center font-bold text-lg">!</div>
                <h3 className="font-serif text-xl text-customRed">Warning Signs to Watch For</h3>
            </div>
            <ul className="space-y-3 pt-2">
                {signs.map((sign, idx) => (
                    <li key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-customRed/90 items-start bg-white/60 p-4 rounded-lg border border-customRed/10">
                        <div className="flex-1">
                            <span className="font-semibold block mb-1">When to act:</span>
                            <span className="leading-snug">{sign.symptom}</span>
                        </div>
                        <div className="sm:w-[1px] sm:h-auto sm:self-stretch bg-customRed/20 rotate-90 sm:rotate-0 my-2 sm:my-0"></div>
                        <div className="flex-1">
                            <span className="font-semibold block mb-1">What to do:</span>
                            <span className="leading-snug text-customRed font-medium">{sign.action}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
