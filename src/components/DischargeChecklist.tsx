import React from 'react';

interface DischargeChecklistProps {
    steps: string[];
}

export function DischargeChecklist({ steps }: DischargeChecklistProps) {
    if (!steps || steps.length === 0) {
        return (
            <div className="border rounded-lg p-6 bg-gray-50 text-center">
                <p className="text-gray-600">
                    No home care steps were provided in this discharge document.
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg p-4 bg-white">
            <ul className="space-y-3">
                {steps.map((step, index) => (
                    <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                            <svg className="h-5 w-5 text-blue-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <span className="ml-3 text-gray-800">{step}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
