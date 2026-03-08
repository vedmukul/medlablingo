// src/components/LabSparkline.tsx
"use client";
import React from "react";

interface SparklinePoint {
    date: string;
    value: number;
}

interface LabSparklineProps {
    points: SparklinePoint[];
    referenceRange?: { low: number; high: number };
    width?: number;
    height?: number;
    className?: string;
}

/**
 * Pure SVG sparkline chart for lab value trends.
 * Shows a compact inline chart with an optional shaded "normal range" band.
 */
export function LabSparkline({
    points,
    referenceRange,
    width = 200,
    height = 48,
    className = "",
}: LabSparklineProps) {
    if (points.length < 2) {
        return (
            <span className={`text-[11px] text-gray-400 ${className}`}>
                {points.length === 1 ? `${points[0].value}` : "—"}
            </span>
        );
    }

    const padding = 4;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const values = points.map((p) => p.value);
    const allValues = referenceRange
        ? [...values, referenceRange.low, referenceRange.high]
        : values;

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    const scaleX = (i: number) => padding + (i / (points.length - 1)) * innerW;
    const scaleY = (v: number) => padding + innerH - ((v - minVal) / range) * innerH;

    // Build the polyline points string
    const linePoints = points
        .map((p, i) => `${scaleX(i)},${scaleY(p.value)}`)
        .join(" ");

    // Determine trend color
    const first = points[0].value;
    const last = points[points.length - 1].value;
    const isInRange = referenceRange
        ? last >= referenceRange.low && last <= referenceRange.high
        : true;
    const trendColor = isInRange ? "#4ade80" : last > first ? "#f87171" : "#facc15"; // green / red / yellow

    return (
        <svg
            width={width}
            height={height}
            className={`inline-block ${className}`}
            viewBox={`0 0 ${width} ${height}`}
        >
            {/* Reference range band */}
            {referenceRange && (
                <rect
                    x={padding}
                    y={scaleY(referenceRange.high)}
                    width={innerW}
                    height={Math.abs(scaleY(referenceRange.low) - scaleY(referenceRange.high))}
                    fill="#d1fae5"
                    opacity={0.4}
                    rx={2}
                />
            )}

            {/* Sparkline */}
            <polyline
                points={linePoints}
                fill="none"
                stroke={trendColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((p, i) => (
                <circle
                    key={i}
                    cx={scaleX(i)}
                    cy={scaleY(p.value)}
                    r={i === points.length - 1 ? 3.5 : 2}
                    fill={i === points.length - 1 ? trendColor : "#9ca3af"}
                    stroke="white"
                    strokeWidth={1}
                />
            ))}

            {/* Value labels: first and last */}
            <text
                x={scaleX(0)}
                y={scaleY(first) - 6}
                fontSize={9}
                fill="#9ca3af"
                textAnchor="start"
            >
                {first}
            </text>
            <text
                x={scaleX(points.length - 1)}
                y={scaleY(last) - 6}
                fontSize={10}
                fill={trendColor}
                textAnchor="end"
                fontWeight="bold"
            >
                {last}
            </text>
        </svg>
    );
}
