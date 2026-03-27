import React from 'react';

export function GeneralInstructions({ sections }: { sections: { title: string, content: string | string[], icon?: string }[] }) {
    const validSections = sections.filter(s => {
        if (!s.content) return false;
        if (Array.isArray(s.content) && s.content.length === 0) return false;
        return true;
    });

    if (validSections.length === 0) return null;

    return (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-5 ml-1">Additional Instructions</h3>

            <div className="space-y-6">
                {validSections.map((section, idx) => (
                    <div key={idx} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                        <h4 className="font-serif text-[18px] text-navy mb-3 flex items-center gap-2">
                            {section.icon && <span>{section.icon}</span>}
                            {section.title}
                        </h4>

                        {Array.isArray(section.content) ? (
                            <ul className="space-y-2">
                                {section.content.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-gray-700 items-start">
                                        <span className="shrink-0 text-sage mt-1">✓</span>
                                        <span className="leading-relaxed text-[14px]">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[14px] leading-relaxed text-gray-700 whitespace-pre-line bg-sand/20 p-4 rounded-lg">
                                {section.content}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
