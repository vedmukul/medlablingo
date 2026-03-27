import React from 'react';

export function DietCard({ diet }: { diet: string }) {
    if (!diet) return null;

    return (
        <div className="bg-sage-light/30 border border-sage/20 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-16 h-16 text-sage" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
            </div>
            <h3 className="font-serif text-xl text-sage mb-2 relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                Dietary Guidance
            </h3>
            <p className="text-[15px] leading-relaxed text-sage-dark pt-2 relative z-10 font-medium">
                {diet}
            </p>
        </div>
    );
}
