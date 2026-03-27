import React from 'react';

interface Medication {
    name: string;
    purposePlain: string;
    howToTakeFromDoc: string;
    cautionsGeneral: string;
}

interface MedicationCardsProps {
    medications: Medication[];
}

export function MedicationCards({ medications }: MedicationCardsProps) {
    if (!medications || medications.length === 0) {
        return (
            <div className="border rounded-lg p-6 bg-gray-50 text-center">
                <p className="text-gray-600">
                    No medications were listed in this discharge document.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {medications.map((med, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white">
                    <h4 className="font-semibold text-lg text-gray-900 mb-3">
                        {med.name}
                    </h4>

                    <div className="space-y-3 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Purpose: </span>
                            <span className="text-gray-800">{med.purposePlain}</span>
                        </div>

                        <div className="bg-blue-50 p-3 rounded border border-blue-100">
                            <span className="font-medium text-blue-900">How to take: </span>
                            <span className="text-blue-800">{med.howToTakeFromDoc}</span>
                        </div>

                        {med.cautionsGeneral && (
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                                <span className="font-medium text-yellow-900">⚠️ Important: </span>
                                <span className="text-yellow-800">{med.cautionsGeneral}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
