import React from 'react';

export function Immunizations({ immunizations }: { immunizations: any[] }) {
    if (!immunizations || immunizations.length === 0) return null;

    // Separate known and unknown date vaccines
    const withDate = immunizations.filter(imm => imm.date && !imm.date.toLowerCase().includes('unknown'));
    const withoutDate = immunizations.filter(imm => !imm.date || imm.date.toLowerCase().includes('unknown'));

    return (
        <div className="space-y-3">
            {withDate.length > 0 && (
                <div className="divide-y divide-gray-100">
                    {withDate.map((imm, idx) => (
                        <div key={idx} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                            <div>
                                <div className="font-medium text-navy text-[15px]">{imm.name}</div>
                                {imm.notes && <div className="text-[12px] text-gray-500 mt-0.5">{imm.notes}</div>}
                            </div>
                            <div className="text-[13px] font-semibold text-sage bg-sage-light/50 px-2.5 py-1 rounded text-right whitespace-nowrap ml-4">
                                {imm.date}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {withoutDate.length > 0 && (
                <>
                    {withDate.length > 0 && (
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-4 mb-2">
                            Date not documented
                        </div>
                    )}
                    <div className="divide-y divide-gray-100">
                        {withoutDate.map((imm, idx) => (
                            <div key={idx} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-navy text-[15px]">{imm.name}</div>
                                    {imm.notes && <div className="text-[12px] text-gray-500 mt-0.5">{imm.notes}</div>}
                                </div>
                                <div className="text-[12px] text-gray-400 italic text-right whitespace-nowrap ml-4">
                                    Date not in document
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
