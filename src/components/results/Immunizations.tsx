import React from 'react';

export function Immunizations({ immunizations }: { immunizations: any[] }) {
    if (!immunizations || immunizations.length === 0) return null;

    return (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                Vaccines & Immunizations
            </h3>
            <div className="divide-y divide-gray-100">
                {immunizations.map((imm, idx) => (
                    <div key={idx} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                        <div>
                            <div className="font-medium text-[#132A3E] text-[15px]">{imm.name}</div>
                            {imm.notes && <div className="text-[12px] text-gray-500 mt-0.5">{imm.notes}</div>}
                        </div>
                        <div className="text-[13px] font-bold uppercase tracking-wider text-sage bg-sage-light/50 px-2 py-1 rounded text-right whitespace-nowrap ml-4">
                            {imm.date}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
