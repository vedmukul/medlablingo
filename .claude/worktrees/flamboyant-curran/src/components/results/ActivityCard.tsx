import React from 'react';

export function ActivityCard({ activityRestrictions }: { activityRestrictions: string }) {
    if (!activityRestrictions) return null;

    return (
        <div className="bg-amber-light/30 border border-amber/20 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-16 h-16 text-amber" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" /></svg>
            </div>
            <h3 className="font-serif text-xl text-amber mb-2 relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Activity Restrictions
            </h3>
            <p className="text-[15px] leading-relaxed text-amber-900 pt-2 relative z-10 font-medium whitespace-pre-line">
                {activityRestrictions}
            </p>
        </div>
    );
}
