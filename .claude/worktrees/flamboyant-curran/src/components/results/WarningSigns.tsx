import React from 'react';

type WarningSignType = {
    symptom: string;
    action: string;
};

export function WarningSigns({ signs }: { signs: (WarningSignType | string)[] }) {
    if (!signs || signs.length === 0) return null;

    return (
        <div
            className="bg-white border-l-[3px] border-amber rounded-xl overflow-hidden"
            role="alert"
            aria-label="When to contact your doctor"
        >
            <div className="px-6 pt-5 pb-4">
                <div className="flex items-center gap-2.5 mb-1">
                    <svg className="w-4.5 h-4.5 text-amber flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <h3 className="text-[15px] font-semibold text-navy">When to contact your doctor</h3>
                </div>
                <p className="text-[13px] text-gray-400 ml-7">If you notice any of the following, reach out to your care team.</p>
            </div>

            <div className="divide-y divide-gray-100">
                {signs.map((sign, idx) => {
                    const isString = typeof sign === 'string';
                    const symptom = isString ? sign : sign.symptom;
                    const action = isString ? '' : sign.action;

                    return (
                        <div
                            key={idx}
                            className={`px-6 py-3.5 flex flex-col sm:flex-row gap-2 sm:gap-8 ${idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Watch for</span>
                                <span className="text-[14px] text-gray-700 leading-snug">{symptom}</span>
                            </div>
                            {action && (
                                <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Then do</span>
                                    <span className="text-[14px] text-navy font-medium leading-snug">{action}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
