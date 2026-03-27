import React from "react";
import { Info } from "lucide-react";

export function DisclaimerBanner() {
    return (
        <div className="bg-sand-dark/50 border border-gray-200 rounded-lg px-5 py-3 flex items-start gap-3 text-[13px] text-gray-500 mb-4">
            <Info className="w-4 h-4 shrink-0 text-teal mt-0.5" strokeWidth={2} aria-hidden />
            <span>Educational use only · Not medical advice · Always consult your doctor</span>
        </div>
    );
}
