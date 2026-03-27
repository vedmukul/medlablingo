/** Merged with model output server-side; also used client-side when older saved results lack escalationGuidance. */
export const US_ESCALATION_DEFAULTS = {
    callEmergencyIf: [
        "Chest pain, pressure, or trouble breathing",
        "Sudden weakness on one side, slurred speech, or confusion",
        "Severe bleeding that will not stop",
        "Thoughts of hurting yourself or others",
    ],
    seekUrgentCareIf: [
        "Fever or symptoms are quickly getting worse",
        "You are unsure if it is an emergency — urgent care or a nurse line can help you decide",
    ],
    crisisNote:
        "In the United States: call or text 988 for the Suicide & Crisis Lifeline, or call 911 for emergencies. Adjust for your country or region.",
} as const;
