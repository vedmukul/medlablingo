// src/lib/calendar/generateICS.ts
//
// Pure utility for generating iCalendar (.ics) files from medication
// schedules and follow-up appointments. Zero external dependencies.

interface MedicationEvent {
    name: string;
    timing?: string;        // e.g., "Twice daily", "Every 8 hours", "At bedtime"
    howToTake?: string;     // e.g., "Take with food"
    purpose?: string;       // e.g., "Blood pressure control"
}

interface AppointmentEvent {
    specialty: string;
    provider?: string;
    dateTime: string;       // e.g., "02/11/2025 @ 1:30 PM"
    purpose: string;
    urgency?: string;
}

// ── Helpers ──────────────────────────────────────────────────

function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}@medlablingo`;
}

function formatDateICS(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeICS(text: string): string {
    return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

/**
 * Parse a free-text timing string into an RRULE frequency and
 * an array of reminder times (hours of the day).
 */
function parseTimingToSchedule(timing: string): { rrule: string; hours: number[] } {
    const t = timing.toLowerCase().trim();

    // "every X hours"
    const everyMatch = t.match(/every\s+(\d+)\s*h/);
    if (everyMatch) {
        const interval = parseInt(everyMatch[1]);
        const hours: number[] = [];
        for (let h = 8; h < 24; h += interval) hours.push(h);
        return { rrule: "FREQ=DAILY;COUNT=30", hours };
    }

    // Common frequency patterns
    if (t.includes("twice daily") || t.includes("bid") || t.includes("2x") || t.includes("two times")) {
        return { rrule: "FREQ=DAILY;COUNT=30", hours: [8, 20] };
    }
    if (t.includes("three times") || t.includes("tid") || t.includes("3x")) {
        return { rrule: "FREQ=DAILY;COUNT=30", hours: [8, 14, 20] };
    }
    if (t.includes("four times") || t.includes("qid") || t.includes("4x")) {
        return { rrule: "FREQ=DAILY;COUNT=30", hours: [8, 12, 16, 20] };
    }
    if (t.includes("bedtime") || t.includes("at night") || t.includes("qhs")) {
        return { rrule: "FREQ=DAILY;COUNT=30", hours: [21] };
    }
    if (t.includes("morning") || t.includes("qam")) {
        return { rrule: "FREQ=DAILY;COUNT=30", hours: [8] };
    }
    if (t.includes("weekly")) {
        return { rrule: "FREQ=WEEKLY;COUNT=12", hours: [8] };
    }

    // Default: once daily in the morning
    return { rrule: "FREQ=DAILY;COUNT=30", hours: [8] };
}

/**
 * Parse a free-text date/time string into a JavaScript Date.
 * Handles formats like "02/11/2025 @ 1:30 PM", "March 5, 2025 at 2:00 PM", etc.
 */
function parseAppointmentDate(raw: string): Date | null {
    // Remove @ symbol
    const cleaned = raw.replace("@", "").replace(/\s+/g, " ").trim();

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;

    // Try MM/DD/YYYY HH:MM AM/PM
    const match = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
        let [, mm, dd, yyyy, hh, min, ampm] = match;
        let hour = parseInt(hh);
        if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
        if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), hour, parseInt(min));
    }

    return null;
}

// ── Generators ───────────────────────────────────────────────

function buildVEVENT(params: {
    summary: string;
    description: string;
    dtstart: string;
    dtend: string;
    rrule?: string;
    alarm?: boolean;
}): string {
    const lines = [
        "BEGIN:VEVENT",
        `UID:${uid()}`,
        `DTSTAMP:${formatDateICS(new Date())}`,
        `DTSTART:${params.dtstart}`,
        `DTEND:${params.dtend}`,
        `SUMMARY:${escapeICS(params.summary)}`,
        `DESCRIPTION:${escapeICS(params.description)}`,
    ];

    if (params.rrule) lines.push(`RRULE:${params.rrule}`);

    if (params.alarm !== false) {
        lines.push(
            "BEGIN:VALARM",
            "TRIGGER:-PT10M",
            "ACTION:DISPLAY",
            `DESCRIPTION:${escapeICS(params.summary)}`,
            "END:VALARM"
        );
    }

    lines.push("END:VEVENT");
    return lines.join("\r\n");
}

function wrapCalendar(events: string[]): string {
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MedLabLingo//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:MedLabLingo Reminders",
        ...events,
        "END:VCALENDAR",
    ].join("\r\n");
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate an ICS file for medication reminders.
 * Creates recurring daily events for each medication for 30 days.
 */
export function generateMedicationICS(meds: MedicationEvent[]): string {
    const today = new Date();
    const events: string[] = [];

    for (const med of meds) {
        const { rrule, hours } = parseTimingToSchedule(med.timing ?? "once daily");
        const desc = [
            med.purpose ? `Purpose: ${med.purpose}` : "",
            med.howToTake ? `How to take: ${med.howToTake}` : "",
            "— Generated by MedLabLingo",
        ].filter(Boolean).join("\\n");

        for (const hour of hours) {
            const start = new Date(today);
            start.setHours(hour, 0, 0, 0);

            const end = new Date(start);
            end.setMinutes(15);

            events.push(
                buildVEVENT({
                    summary: `💊 ${med.name}`,
                    description: desc,
                    dtstart: formatDateICS(start),
                    dtend: formatDateICS(end),
                    rrule,
                })
            );
        }
    }

    return wrapCalendar(events);
}

/**
 * Generate an ICS file for a single follow-up appointment.
 */
export function generateAppointmentICS(appt: AppointmentEvent): string {
    const parsed = parseAppointmentDate(appt.dateTime);
    if (!parsed) {
        // Fallback: create event for tomorrow at 9 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return generateAppointmentICSFromDate(appt, tomorrow);
    }
    return generateAppointmentICSFromDate(appt, parsed);
}

function generateAppointmentICSFromDate(appt: AppointmentEvent, date: Date): string {
    const end = new Date(date);
    end.setHours(date.getHours() + 1);

    const desc = [
        `Specialty: ${appt.specialty}`,
        appt.provider ? `Provider: ${appt.provider}` : "",
        `Purpose: ${appt.purpose}`,
        appt.urgency ? `Urgency: ${appt.urgency}` : "",
        "",
        "— Generated by MedLabLingo",
    ].filter(Boolean).join("\\n");

    const event = buildVEVENT({
        summary: `📅 ${appt.specialty}: ${appt.purpose}`,
        description: desc,
        dtstart: formatDateICS(date),
        dtend: formatDateICS(end),
    });

    return wrapCalendar([event]);
}

/**
 * Trigger a browser download of an ICS file.
 */
export function downloadICS(content: string, filename: string = "medlablingo-reminders.ics") {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
