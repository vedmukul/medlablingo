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
            <div className="border border-accent-muted rounded-card p-6 bg-surface text-center">
                <p className="text-text-secondary">
                    No medications were listed in this discharge document.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {medications.map((med, index) => (
                <div key={index} className="border border-accent-muted rounded-card p-4 bg-surface-card shadow-card">
                    <h4 className="font-semibold text-lg text-text-primary mb-3">
                        {med.name}
                    </h4>

                    <div className="space-y-3 text-sm">
                        <div>
                            <span className="font-medium text-text-secondary">Purpose: </span>
                            <span className="text-text-primary">{med.purposePlain}</span>
                        </div>

                        <div className="bg-accent-light p-3 rounded-card border border-accent-muted">
                            <span className="font-medium text-accent-dark">How to take: </span>
                            <span className="text-text-primary">{med.howToTakeFromDoc}</span>
                        </div>

                        {med.cautionsGeneral && (
                            <div className="bg-status-caution-bg p-3 rounded-card border border-status-caution/30">
                                <span className="font-medium text-status-caution">Important: </span>
                                <span className="text-text-primary">{med.cautionsGeneral}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
