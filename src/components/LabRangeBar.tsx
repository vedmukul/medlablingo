import React from 'react';

interface LabRangeBarProps {
    value: string;
    referenceRange: string | null;
    unit: string | null;
    flag: "low" | "high" | "normal" | "borderline" | "unknown";
}

interface ParsedRange {
    min: number | null;
    max: number | null;
    type: 'range' | 'min-only' | 'max-only';
}

export function LabRangeBar({ value, referenceRange, unit, flag }: LabRangeBarProps) {
    if (!referenceRange) return null;

    /**
     * Extract numeric value from string
     */
    const extractNumeric = (val: string): number | null => {
        const match = val.match(/[\d.]+/);
        if (!match) return null;
        const num = parseFloat(match[0]);
        return isNaN(num) ? null : num;
    };

    /**
     * Parse reference range into min/max values
     * Supports: "70-99", "3.5 - 5.0", "≤ 200", "< 200", "≥ 10", "> 10"
     */
    const parseRange = (range: string): ParsedRange | null => {
        const cleaned = range.trim();

        // Pattern 1: Range (e.g., "70-99", "3.5 - 5.0")
        const rangeMatch = cleaned.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
        if (rangeMatch) {
            const min = parseFloat(rangeMatch[1]);
            const max = parseFloat(rangeMatch[2]);
            if (!isNaN(min) && !isNaN(max)) {
                return { min, max, type: 'range' };
            }
        }

        // Pattern 2: Max only (e.g., "≤ 200", "< 200", "<200")
        const maxMatch = cleaned.match(/^[≤<]\s*([\d.]+)$/);
        if (maxMatch) {
            const max = parseFloat(maxMatch[1]);
            if (!isNaN(max)) {
                return { min: null, max, type: 'max-only' };
            }
        }

        // Pattern 3: Min only (e.g., "≥ 10", "> 10", ">10")
        const minMatch = cleaned.match(/^[≥>]\s*([\d.]+)$/);
        if (minMatch) {
            const min = parseFloat(minMatch[1]);
            if (!isNaN(min)) {
                return { min, max: null, type: 'min-only' };
            }
        }

        return null;
    };

    const currentValue = extractNumeric(value);
    const parsedRange = parseRange(referenceRange);

    // Don't render if we can't parse either value or range
    if (currentValue === null || !parsedRange) {
        return null;
    }

    /**
     * Calculate position and render the visual range bar
     */
    const renderRangeBar = () => {
        const { min, max, type } = parsedRange;

        // Determine the visual scale
        let scaleMin: number;
        let scaleMax: number;
        let normalStart: number;
        let normalEnd: number;

        if (type === 'range' && min !== null && max !== null) {
            // Full range: extend scale by 20% on each side
            const padding = (max - min) * 0.2;
            scaleMin = Math.max(0, min - padding);
            scaleMax = max + padding;
            normalStart = min;
            normalEnd = max;
        } else if (type === 'max-only' && max !== null) {
            // Max only: show 0 to 150% of max
            scaleMin = 0;
            scaleMax = max * 1.5;
            normalStart = 0;
            normalEnd = max;
        } else if (type === 'min-only' && min !== null) {
            // Min only: show min to 200% of min
            scaleMin = Math.max(0, min * 0.5);
            scaleMax = min * 2;
            normalStart = min;
            normalEnd = scaleMax;
        } else {
            return null;
        }

        // Clamp current value to visible scale
        const clampedValue = Math.max(scaleMin, Math.min(scaleMax, currentValue));

        // Calculate percentages
        const normalStartPercent = ((normalStart - scaleMin) / (scaleMax - scaleMin)) * 100;
        const normalEndPercent = ((normalEnd - scaleMin) / (scaleMax - scaleMin)) * 100;
        const valuePercent = ((clampedValue - scaleMin) / (scaleMax - scaleMin)) * 100;

        // Determine marker color based on flag
        const getMarkerColor = () => {
            if (flag === 'high') return 'bg-red-600';
            if (flag === 'low') return 'bg-blue-600';
            if (flag === 'borderline') return 'bg-yellow-600';
            return 'bg-green-600';
        };

        return (
            <div className="relative w-full h-8 my-2">
                {/* Scale background */}
                <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
                    {/* Normal range highlighted */}
                    <div
                        className="absolute h-full bg-green-100 border-l border-r border-green-300"
                        style={{
                            left: `${normalStartPercent}%`,
                            width: `${normalEndPercent - normalStartPercent}%`,
                        }}
                    />
                </div>

                {/* Value marker */}
                <div
                    className="absolute top-0 bottom-0 flex items-center justify-center transition-all"
                    style={{ left: `${valuePercent}%`, transform: 'translateX(-50%)' }}
                >
                    <div className={`w-3 h-3 rounded-full ${getMarkerColor()} border-2 border-white shadow-md`} />
                </div>

                {/* Labels */}
                <div className="absolute -bottom-5 left-0 text-xs text-gray-500">
                    {scaleMin.toFixed(0)}
                </div>
                {min !== null && max !== null && (
                    <>
                        <div
                            className="absolute -bottom-5 text-xs text-green-700 font-medium"
                            style={{ left: `${normalStartPercent}%`, transform: 'translateX(-50%)' }}
                        >
                            {min}
                        </div>
                        <div
                            className="absolute -bottom-5 text-xs text-green-700 font-medium"
                            style={{ left: `${normalEndPercent}%`, transform: 'translateX(-50%)' }}
                        >
                            {max}
                        </div>
                    </>
                )}
                <div className="absolute -bottom-5 right-0 text-xs text-gray-500">
                    {scaleMax.toFixed(0)}
                </div>
            </div>
        );
    };

    return (
        <div className="mt-3 mb-6">
            <div className="text-xs text-gray-600 mb-1">Value on scale:</div>
            {renderRangeBar()}
        </div>
    );
}
