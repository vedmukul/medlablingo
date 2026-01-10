import React from 'react';

interface LabItem {
    name: string;
    value: string;
    unit: string | null;
    referenceRange: string | null;
    flag: "low" | "high" | "normal" | "borderline" | "unknown";
    importance: "low" | "medium" | "high" | "unknown";
    explanation: string;
}

interface LabsTableProps {
    labs: LabItem[];
}

export function LabsTable({ labs }: LabsTableProps) {
    if (!labs || labs.length === 0) {
        return (
            <div className="border rounded-lg p-6 bg-gray-50 text-center">
                <p className="text-gray-600">
                    No lab values were parsed from this document. Try uploading a clearer PDF with visible lab results.
                </p>
            </div>
        );
    }

    const getFlagColor = (flag: LabItem['flag']) => {
        switch (flag) {
            case 'high':
                return 'text-red-700 bg-red-50 border-red-200';
            case 'low':
                return 'text-blue-700 bg-blue-50 border-blue-200';
            case 'borderline':
                return 'text-yellow-700 bg-yellow-50 border-yellow-200';
            case 'normal':
                return 'text-green-700 bg-green-50 border-green-200';
            default:
                return 'text-gray-700 bg-gray-50 border-gray-200';
        }
    };

    const getImportanceBadge = (importance: LabItem['importance']) => {
        if (importance === 'high') {
            return <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">High Priority</span>;
        }
        if (importance === 'medium') {
            return <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Medium</span>;
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {labs.map((lab, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <h4 className="font-medium text-gray-900">
                                {lab.name}
                                {getImportanceBadge(lab.importance)}
                            </h4>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium rounded border ${getFlagColor(lab.flag)}`}>
                            {lab.flag.toUpperCase()}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div>
                            <span className="text-gray-600">Value: </span>
                            <span className="font-semibold text-gray-900">
                                {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                            </span>
                        </div>
                        {lab.referenceRange && (
                            <div>
                                <span className="text-gray-600">Reference Range: </span>
                                <span className="text-gray-900">{lab.referenceRange}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">
                        <span className="font-medium text-blue-900">What this means: </span>
                        {lab.explanation}
                    </p>
                </div>
            ))}
        </div>
    );
}
