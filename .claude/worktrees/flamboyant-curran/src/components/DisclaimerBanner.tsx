import React from 'react';

export function DisclaimerBanner() {
    return (
        <div className="bg-sand-dark/50 border border-gray-200 rounded-lg px-5 py-3 flex items-center gap-3 text-[13px] text-gray-500 mb-6">
            <span className="text-[16px] leading-none mb-px">ℹ</span>
            <span>Educational use only · Not medical advice · Always consult your doctor</span>
        </div>
    );
}
