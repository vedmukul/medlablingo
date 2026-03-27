import React, { useEffect, useState } from 'react';
import { LabRangeBar } from './LabRangeBar';

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

type Severity = 'critical' | 'warning' | 'normal';

interface TrendInfo {
    direction: '↑' | '↓' | '→' | '—';
    previousValue: string | null;
    delta: number | null;
}

// History key for lab trends
const LAB_HISTORY_KEY = 'lablingo_lab_history_v1';
const MAX_HISTORY_ITEMS = 5;

interface HistoricalLab {
    name: string;
    value: string;
    timestamp: string;
}

export function LabsTable({ labs }: LabsTableProps) {
    const [trends, setTrends] = useState<Map<string, TrendInfo>>(new Map());

    useEffect(() => {
        // Calculate trends on mount
        const trendMap = calculateTrends(labs);
        setTrends(trendMap);

        // Save current labs to history
        saveToHistory(labs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labs]);

    if (!labs || labs.length === 0) {
        return (
            <div className="border border-accent-muted rounded-card p-6 bg-surface text-center">
                <p className="text-text-secondary">
                    No lab values were parsed from this document. Try uploading a clearer PDF with visible lab results.
                </p>
            </div>
        );
    }

    /**
     * Normalize lab name for matching (lowercase, trim, remove special chars)
     */
    const normalizeName = (name: string): string => {
        return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    };

    /**
     * Extract numeric value from string (e.g., "123.4" from "123.4 mg/dL")
     */
    const extractNumeric = (value: string): number | null => {
        const match = value.match(/^[\d.]+/);
        if (!match) return null;
        const num = parseFloat(match[0]);
        return isNaN(num) ? null : num;
    };

    /**
     * Load historical labs from localStorage
     */
    const loadHistory = (): HistoricalLab[] => {
        try {
            const raw = localStorage.getItem(LAB_HISTORY_KEY);
            if (!raw) return [];
            return JSON.parse(raw) as HistoricalLab[];
        } catch {
            return [];
        }
    };

    /**
     * Save current labs to history
     */
    const saveToHistory = (currentLabs: LabItem[]) => {
        try {
            const history = loadHistory();
            const timestamp = new Date().toISOString();

            // Add current labs to history
            const newEntries: HistoricalLab[] = currentLabs.map(lab => ({
                name: lab.name,
                value: lab.value,
                timestamp,
            }));

            // Combine with existing history, keep most recent MAX_HISTORY_ITEMS per lab
            const combined = [...newEntries, ...history];

            // Group by normalized name and keep only recent entries
            const grouped = new Map<string, HistoricalLab[]>();
            combined.forEach(entry => {
                const normalized = normalizeName(entry.name);
                if (!grouped.has(normalized)) {
                    grouped.set(normalized, []);
                }
                grouped.get(normalized)!.push(entry);
            });

            // Keep only most recent entries per lab
            const pruned: HistoricalLab[] = [];
            grouped.forEach(entries => {
                const sorted = entries.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                pruned.push(...sorted.slice(0, MAX_HISTORY_ITEMS));
            });

            localStorage.setItem(LAB_HISTORY_KEY, JSON.stringify(pruned));
        } catch (err) {
            console.warn('Failed to save lab history:', err);
        }
    };

    /**
     * Calculate trends by comparing current labs with history
     */
    const calculateTrends = (currentLabs: LabItem[]): Map<string, TrendInfo> => {
        const trendMap = new Map<string, TrendInfo>();
        const history = loadHistory();

        currentLabs.forEach(lab => {
            const normalized = normalizeName(lab.name);

            // Find previous value for this lab (excluding current timestamp)
            const previousEntries = history.filter(h =>
                normalizeName(h.name) === normalized
            );

            if (previousEntries.length === 0) {
                // No previous data
                trendMap.set(lab.name, {
                    direction: '—',
                    previousValue: null,
                    delta: null,
                });
                return;
            }

            // Get most recent previous entry (sorted by timestamp)
            const sorted = previousEntries.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const previous = sorted[0];

            const currentNumeric = extractNumeric(lab.value);
            const previousNumeric = extractNumeric(previous.value);

            if (currentNumeric !== null && previousNumeric !== null) {
                const delta = currentNumeric - previousNumeric;
                let direction: '↑' | '↓' | '→';

                if (Math.abs(delta) < 0.01) {
                    direction = '→';
                } else if (delta > 0) {
                    direction = '↑';
                } else {
                    direction = '↓';
                }

                trendMap.set(lab.name, {
                    direction,
                    previousValue: previous.value,
                    delta,
                });
            } else {
                // Non-numeric values
                trendMap.set(lab.name, {
                    direction: '—',
                    previousValue: previous.value,
                    delta: null,
                });
            }
        });

        return trendMap;
    };

    /**
     * Determine severity level based on flag and importance
     */
    const getSeverity = (lab: LabItem): Severity => {
        const flagLower = lab.flag.toLowerCase();

        if (flagLower.includes('critical') || lab.importance === 'high') {
            return 'critical';
        }

        if (flagLower === 'high' || flagLower === 'low' || lab.importance === 'medium') {
            return 'warning';
        }

        return 'normal';
    };

    /**
     * Get styling classes based on severity
     */
    const getSeverityStyles = (severity: Severity) => {
        switch (severity) {
            case 'critical':
                return {
                    border: 'border-l-4 border-l-status-critical',
                    background: 'bg-status-critical-bg',
                    cardBorder: 'border-status-critical/30',
                };
            case 'warning':
                return {
                    border: 'border-l-4 border-l-status-caution',
                    background: 'bg-status-caution-bg',
                    cardBorder: 'border-status-caution/30',
                };
            default:
                return {
                    border: 'border-l-4 border-l-accent-muted',
                    background: 'bg-surface-card',
                    cardBorder: 'border-accent-muted',
                };
        }
    };

    /**
     * Get severity badge if applicable
     */
    const getSeverityBadge = (lab: LabItem, severity: Severity) => {
        const flagLower = lab.flag.toLowerCase();

        if (flagLower.includes('critical') || severity === 'critical') {
            return (
                <span className="px-2 py-1 text-xs font-bold bg-status-critical text-text-inverse rounded uppercase">
                    CRITICAL
                </span>
            );
        }

        if (flagLower === 'high') {
            return (
                <span className="px-2 py-1 text-xs font-semibold bg-status-caution text-text-inverse rounded uppercase">
                    HIGH
                </span>
            );
        }

        if (flagLower === 'low') {
            return (
                <span className="px-2 py-1 text-xs font-semibold bg-accent text-text-inverse rounded uppercase">
                    LOW
                </span>
            );
        }

        return null;
    };

    /**
     * Get flag color for the existing flag badge
     */
    const getFlagColor = (flag: LabItem['flag']) => {
        switch (flag) {
            case 'high':
                return 'text-status-critical bg-status-critical-bg border-status-critical/30';
            case 'low':
                return 'text-accent-dark bg-accent-light border-accent-muted';
            case 'borderline':
                return 'text-status-caution bg-status-caution-bg border-status-caution/30';
            case 'normal':
                return 'text-status-normal bg-status-normal-bg border-status-normal/30';
            default:
                return 'text-text-secondary bg-surface border-accent-muted';
        }
    };

    /**
     * Get importance badge
     */
    const getImportanceBadge = (importance: LabItem['importance']) => {
        if (importance === 'high') {
            return <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-status-critical-bg text-status-critical rounded">High Priority</span>;
        }
        if (importance === 'medium') {
            return <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-status-caution-bg text-status-caution rounded">Medium</span>;
        }
        return null;
    };

    /**
     * Format delta for display
     */
    const formatDelta = (delta: number | null): string => {
        if (delta === null) return '';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(2)}`;
    };

    /**
     * Get trend arrow color based on direction and flag
     */
    const getTrendColor = (direction: string, flag: string): string => {
        if (direction === '—') return 'text-text-muted';

        const flagLower = flag.toLowerCase();

        // If going up and flag is high, or going down and flag is low, it's concerning
        if ((direction === '↑' && flagLower === 'high') ||
            (direction === '↓' && flagLower === 'low')) {
            return 'text-status-critical font-bold';
        }

        // If trend is improving (going down when high, going up when low)
        if ((direction === '↓' && flagLower === 'high') ||
            (direction === '↑' && flagLower === 'low')) {
            return 'text-status-normal font-bold';
        }

        return 'text-accent';
    };

    return (
        <div className="space-y-4">
            {labs.map((lab, index) => {
                const severity = getSeverity(lab);
                const styles = getSeverityStyles(severity);
                const severityBadge = getSeverityBadge(lab, severity);
                const trend = trends.get(lab.name);

                return (
                    <div
                        key={index}
                        className={`border rounded-card p-4 shadow-card ${styles.border} ${styles.background} ${styles.cardBorder}`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-text-primary">
                                        {lab.name}
                                    </h4>
                                    {severityBadge}
                                    {getImportanceBadge(lab.importance)}
                                </div>
                            </div>
                            <span className={`px-3 py-1 text-sm font-medium rounded border ${getFlagColor(lab.flag)} ml-2`}>
                                {lab.flag.toUpperCase()}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                            <div>
                                <span className="text-text-secondary">Value: </span>
                                <span className="font-semibold text-text-primary">
                                    {lab.value}{lab.unit ? ` ${lab.unit}` : ''}
                                </span>
                                {trend && trend.direction !== '—' && (
                                    <span className={`ml-2 ${getTrendColor(trend.direction, lab.flag)}`}>
                                        {trend.direction}
                                        {trend.delta !== null && (
                                            <span className="text-xs ml-1">
                                                {formatDelta(trend.delta)}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                            {lab.referenceRange && (
                                <div>
                                    <span className="text-text-secondary">Reference Range: </span>
                                    <span className="text-text-primary">{lab.referenceRange}</span>
                                </div>
                            )}
                        </div>

                        {/* Show previous value if available */}
                        {trend && trend.previousValue && trend.direction !== '—' && (
                            <div className="mb-3 text-xs text-text-secondary">
                                <span>Previous: {trend.previousValue}</span>
                            </div>
                        )}

                        {/* Visual range chart */}
                        <LabRangeBar
                            value={lab.value}
                            referenceRange={lab.referenceRange}
                            unit={lab.unit}
                            flag={lab.flag}
                        />

                        <p className="text-sm text-text-primary bg-accent-light p-3 rounded-card border border-accent-muted">
                            <span className="font-medium text-accent-dark">What this means: </span>
                            {lab.explanation}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
