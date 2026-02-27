# MedLabLingo — Comprehensive Fix: Never Miss a Detail

> **Purpose:** This is the single authoritative prompt for fixing MedLabLingo so that every piece of clinically relevant information from any uploaded medical document is extracted, structured, and rendered to the patient. No section, lab value, medication, appointment, or instruction should ever be silently dropped.

---

## The Problem (with evidence)

We tested MedLabLingo against 3 hyper-realistic synthetic discharge summaries and found systematic data loss:

### Document 1: Complex Cardiac + Renal (ICU Discharge)
- **Rendered:** Summary, 10 doctor questions, ~30 lab values (only abnormals) ✅
- **Dropped entirely:** 15 discharge medications, 8 follow-up appointments, all home care instructions (2g sodium diet, 1.5L fluid restriction, daily weights, wound care), all imaging results (2 TTEs, 2 CXRs, thoracentesis, Swan-Ganz catheterization), 4 discontinued medications with reasons, blood sugar monitoring protocol, cardiac rehab referral, activity restrictions
- **Partially dropped:** 18 normal lab values skipped, serial/trending values (4 timepoints → only discharge shown), some explanations used vague language ("might be related to your condition")
- **Bug:** `[FILTERED]` redaction token leaked into patient-facing summary text

### Document 2: NICU Premature Infant Discharge
- **Rendered:** Summary, 10 doctor questions, all 16 lab values (including normals this time) ✅
- **Dropped entirely:** 3 discharge medications + supplement timing, complete feeding plan with specific volumes/frequencies, safe sleep instructions (SIDS prevention — life-safety), all 7 warning signs with specific thresholds, 8 follow-up appointments (one marked "critical, do NOT miss"), full immunization record with future schedule, developmental guidance (corrected vs chronological age), respiratory monitoring precautions, birth history, entire 71-day NICU course
- **Partially dropped:** Lab explanations missing clinical context connections (e.g., CRP <1 should reference resolved sepsis episode where CRP peaked at 42)

### Root Cause
The Zod schema in `analysisSchema.ts` enforces a **mutually exclusive** discriminated union: `lab_report` gets `labsSection` only, `discharge_instructions` gets `dischargeSection` only. Real discharge summaries are **hybrid documents** containing both labs AND discharge content. The app was forced to pick one, so all content from the other side was structurally impossible to return.

---

## Architecture Reference

```
src/contracts/analysisSchema.ts       ← Zod schema (SOURCE OF TRUTH — controls everything)
src/lib/ai/analyzeDocument.ts         ← AI prompt builder + LLM call + retry + validation
src/lib/ai/providers/gemini.ts        ← Active AI provider (Gemini 3 Flash)
src/lib/ai/providers/openai.ts        ← Fallback provider
src/lib/ai/providers/types.ts         ← Provider interface
src/lib/safety/redact.ts              ← PHI redaction (source of [FILTERED] bug)
src/lib/safety/safetyFilter.ts        ← Post-AI medical overreach filter
src/app/upload/page.tsx               ← Upload form with documentType dropdown
src/app/api/analyze/route.ts          ← API route (receives upload, runs pipeline)
src/app/results/page.tsx              ← Main results display page
src/app/results/print/page.tsx        ← Print-ready PDF export
src/app/clinician/review/page.tsx     ← Clinician-facing structured summary
src/components/LabsTable.tsx          ← Lab results with flag + trend indicators
src/components/LabRangeBar.tsx        ← Visual normal/abnormal range bar
src/components/MedicationCards.tsx     ← Discharge medication display
src/components/DischargeChecklist.tsx  ← Discharge checklist
src/components/QuestionsForDoctor.tsx  ← Doctor questions display
src/components/DisclaimerBanner.tsx    ← Safety disclaimer
src/components/SummaryCard.tsx        ← Summary header card
src/components/AnalysisChat.tsx       ← "Ask about your results" chat sidebar
src/lib/persistence/analysisStorage.ts ← localStorage (24h TTL, 10-entry history)
```

**Current schema structure (the constraint causing data loss):**
```
AnalysisSchemaUnion = union([
    LabReportAnalysisSchema       → requires labsSection, forbids dischargeSection
    DischargeInstructionsSchema   → requires dischargeSection, forbids labsSection
])
```

**Current AI prompt location:** `buildSystemPrompt()` and `buildUserPrompt()` in `analyzeDocument.ts`

**Current document types:** `"lab_report" | "discharge_instructions"` — selected by user at upload

---

## Change 1: Schema Overhaul — `src/contracts/analysisSchema.ts`

### 1A. Add new document type

```typescript
const DocumentTypeSchema = z.enum([
    "lab_report",
    "discharge_instructions",
    "discharge_summary"           // ← NEW: hybrid documents with both labs AND discharge content
]);
```

### 1B. Add new sub-schemas for previously un-modeled content

```typescript
// ── Imaging & Procedures ──────────────────────────────────
const ImagingKeyValueSchema = z.object({
    label: z.string(),              // e.g., "Ejection Fraction", "PA Pressure"
    value: z.string(),              // e.g., "22%", "62/30 mmHg"
    interpretation: z.string(),     // e.g., "Severely reduced heart pumping ability"
}).strict();

const ImagingItemSchema = z.object({
    name: z.string(),               // e.g., "Transthoracic Echocardiogram (TTE)"
    date: z.string().optional(),    // e.g., "01/15/2025"
    findingsPlain: z.string(),      // Full plain-language explanation
    keyValues: z.array(ImagingKeyValueSchema).optional(),
    confidenceScore: ConfidenceScoreSchema,
}).strict();

// ── Discontinued Medications ──────────────────────────────
const DiscontinuedMedicationSchema = z.object({
    name: z.string(),               // e.g., "Metformin"
    reasonPlain: z.string(),        // e.g., "Stopped because kidney function too low for safe use"
    replacedBy: z.string().optional(), // e.g., "Empagliflozin (Jardiance)"
}).strict();

// ── Immunization Records ──────────────────────────────────
const ImmunizationSchema = z.object({
    name: z.string(),               // e.g., "DTaP/IPV/Hib (Pentacel) #1"
    date: z.string(),               // e.g., "01/18/2025"
    notes: z.string().optional(),   // e.g., "2 months chronological age"
}).strict();

// ── Follow-Up Appointments ────────────────────────────────
const FollowUpAppointmentSchema = z.object({
    specialty: z.string(),          // e.g., "Pediatric Ophthalmology"
    provider: z.string().optional(),// e.g., "Dr. R. Sanchez"
    dateTime: z.string(),           // e.g., "02/11/2025 @ 1:30 PM"
    purpose: z.string(),            // e.g., "ROP follow-up screening"
    urgency: z.enum(["routine", "important", "critical"]).optional(),
    // "critical" = document explicitly flags as must-not-miss
}).strict();
```

### 1C. Expand DischargeSectionSchema with new optional fields

Add these to the existing `DischargeSectionSchema` as **optional** fields to maintain backward compatibility:

```typescript
const DischargeSectionSchema = z.object({
    status: DischargeStatusSchema,
    homeCareSteps: z.array(z.string()),
    medications: z.array(MedicationSchema),
    followUp: z.array(z.string()),                        // Keep existing for backward compat
    followUpStructured: z.array(FollowUpAppointmentSchema).optional(),  // NEW structured version
    warningSignsFromDoc: z.array(z.string()),
    generalRedFlags: z.array(z.string()),
    diagnosesMentionedInDoc: z.array(z.string()),
    // ── NEW FIELDS (all optional for backward compatibility) ──
    dietInstructions: z.string().optional(),               // e.g., "2g sodium, 1.5L fluid/day"
    activityRestrictions: z.string().optional(),            // e.g., "No lifting >10 lbs for 2 weeks"
    dailyMonitoring: z.array(z.string()).optional(),        // e.g., ["Weigh every morning", "Check BG 4x/day"]
    feedingPlan: z.string().optional(),                     // For neonatal: specific volumes, frequencies
    safeSleepInstructions: z.string().optional(),           // For neonatal: SIDS prevention
    woundCare: z.string().optional(),                       // Wound/incision care instructions
    respiratoryPrecautions: z.string().optional(),          // e.g., "Avoid crowds, hand hygiene, smoke"
    developmentalGuidance: z.string().optional(),           // e.g., "Use corrected age until age 2"
}).strict();
```

### 1D. Create the DischargeSummaryAnalysisSchema (the hybrid type)

```typescript
const DischargeSummaryAnalysisSchema = BaseAnalysisSchema.extend({
    meta: MetaSchema.extend({
        documentType: z.literal("discharge_summary"),
    }).strict(),
    labsSection: LabsSectionSchema.optional(),              // ← OPTIONAL (may or may not have labs)
    dischargeSection: DischargeSectionSchema.optional(),     // ← OPTIONAL (may or may not have d/c instructions)
    imagingAndProcedures: z.array(ImagingItemSchema).optional(),
    discontinuedMedications: z.array(DiscontinuedMedicationSchema).optional(),
    immunizations: z.array(ImmunizationSchema).optional(),
    birthHistory: z.string().optional(),                    // Plain-language birth narrative (for NICU)
    hospitalCourse: z.string().optional(),                  // Brief plain-language course summary
}).strict();
```

### 1E. Update the union and exports

```typescript
export const AnalysisSchemaUnion = z.union([
    LabReportAnalysisSchema,
    DischargeInstructionsAnalysisSchema,
    DischargeSummaryAnalysisSchema,       // ← NEW
]);

// New type guard
export function isDischargeSummary(
    result: AnalysisResult
): result is DischargeSummaryAnalysis {
    return result.meta.documentType === "discharge_summary";
}
```

### 1F. Bump schema version

Add `"1.2.0"` to MetaSchema's `schemaVersion` enum. Keep `"1.0.0"` and `"1.1.0"` for backward compatibility.

---

## Change 2: Fix [FILTERED] Bug — Three-Layer Fix

### 2A. `src/lib/safety/redact.ts`
Ensure the redaction replacement token is consistent. If using `[FILTERED]`, keep it — but the real fix is in 2B and 2C.

### 2B. `src/lib/ai/analyzeDocument.ts` — Add to system prompt
Add this instruction to `buildSystemPrompt()`:

```
REDACTION HANDLING:
The input text contains [FILTERED] or [REDACTED] tokens where personal health information
was removed before being sent to you. In ALL of your output text (summaries, explanations,
takeaways, instructions), you must:
- NEVER include [FILTERED] or [REDACTED] tokens in your output
- Write around redacted information naturally
- Example: Instead of "[FILTERED] several follow-up appointments", write "Several follow-up appointments are scheduled"
- Example: Instead of "Patient [FILTERED] was admitted", write "The patient was admitted"
```

### 2C. `src/lib/safety/safetyFilter.ts` — Post-processing cleanup
Add a final pass that strips any surviving redaction artifacts from ALL string fields in the output:

```typescript
function cleanRedactionArtifacts(text: string): string {
    return text
        .replace(/\[FILTERED\]/gi, '')
        .replace(/\[REDACTED\]/gi, '')
        .replace(/\s{2,}/g, ' ')     // collapse double spaces left behind
        .trim();
}
```

Apply this recursively to every string field in the analysis result before returning it.

---

## Change 3: AI Prompt Rewrite — `src/lib/ai/analyzeDocument.ts`

This is the most critical change. The AI prompt controls what gets extracted. Update `buildSystemPrompt()` and `buildUserPrompt()` to add comprehensive handling for the `discharge_summary` type.

### 3A. Add to `buildSystemPrompt()` — discharge_summary case

```
When documentType is "discharge_summary":

You are analyzing a comprehensive medical discharge summary. These documents are hybrid —
they contain BOTH clinical data (lab results, imaging, procedures) AND patient instructions
(medications, home care, follow-up, warning signs). You MUST extract EVERYTHING from BOTH sides.

═══════════════════════════════════════════════════════════════
ABSOLUTE RULE: EXTRACT EVERYTHING. DO NOT SUMMARIZE OR TRUNCATE.
═══════════════════════════════════════════════════════════════

If the document lists 15 medications, return ALL 15 with full details.
If there are 8 follow-up appointments, return ALL 8.
If there are 50 lab values, return ALL 50 — including normal results.
This is the patient's instruction manual for going home. Every detail is safety-critical.

EXTRACTION REQUIREMENTS BY SECTION (all fields populate the schema):

1. PATIENT SUMMARY (patientSummary):
   - overallSummary: 3-5 sentence plain-language overview of why they were hospitalized, 
     what happened, and how they are at discharge
   - keyTakeaways: 3-7 bullet points covering the most important things the patient/family 
     needs to understand. For NICU documents, address PARENTS ("your baby"), not the patient.

2. LAB RESULTS (labsSection):
   - Extract EVERY lab value from the document, including:
     * Normal results (patients need reassurance and completeness)
     * Abnormal results with context-specific explanations
     * Screening tests (NBS, ABR) — use the qualitative result as the "value"
   - For serial/trending values (same test at multiple timepoints):
     * Use the MOST RECENT value as the primary value
     * In the explanation, state all available values with dates/timepoints
       (e.g., "Your BNP was 4,280 at admission, decreased to 3,120 on day 3, 
       1,840 on day 5, and 980 at discharge — showing steady improvement")
     * Characterize the trend: "improving", "worsening", "stable", or "resolved"
   - For each lab explanation:
     * Connect to the patient's SPECIFIC diagnoses, not generic definitions
     * Mention related medications when relevant (e.g., "TSH is monitored because 
       amiodarone can affect thyroid function")
     * Cross-reference related labs (e.g., "Low iron, low TSAT, and high TIBC together 
       confirm iron deficiency")
     * Never use vague language like "might be related to your condition" — name the condition
   - Use NEONATAL reference ranges for infant documents, and explicitly note when a value 
     would be abnormal in adults but is normal in neonates

3. DISCHARGE MEDICATIONS (dischargeSection.medications):
   - Extract EVERY medication, no exceptions. Include:
     * Full name (brand and generic)
     * Exact dosing from the document (dose, route, frequency)
     * Plain-language purpose ("This helps your heart pump better")
     * Timing relative to other medications ("Take metolazone 30 minutes BEFORE furosemide")
     * Specific cautions and what to watch for
   - For supplements (Vitamin D, iron, multivitamins), include the exact product name and 
     when to start if delayed

4. DISCONTINUED MEDICATIONS (discontinuedMedications):
   - If any medications were STOPPED, list each with:
     * Name
     * Plain-language reason why it was stopped
     * What replaced it (if anything)
   - This is safety-critical: patients need to know what they should NO LONGER take

5. HOME CARE INSTRUCTIONS (dischargeSection.homeCareSteps):
   - Extract EVERY instruction: diet, activity, wound care, monitoring tasks, restrictions
   - Preserve specific numbers (sodium grams, fluid limits, calorie targets, weight thresholds)
   - Include WHEN to call the doctor for each instruction where applicable

6. DIET INSTRUCTIONS (dischargeSection.dietInstructions):
   - Extract ALL dietary restrictions and targets as a single comprehensive string
   - Include: sodium limit, fluid restriction, calorie target, special diet type, supplements

7. ACTIVITY RESTRICTIONS (dischargeSection.activityRestrictions):
   - Include lifting limits, exercise guidance, cardiac rehab referrals, return-to-work timelines

8. DAILY MONITORING (dischargeSection.dailyMonitoring):
   - Extract EVERY daily self-monitoring task as an array of specific instructions
   - Include exact thresholds ("Call if weight increases >3 lbs in 24 hours")
   - Include timing ("Weigh every morning BEFORE breakfast, AFTER urinating")

9. FEEDING PLAN (dischargeSection.feedingPlan) — for neonatal documents:
   - Extract exact volumes (mL), frequencies (times/day), caloric density (kcal/oz)
   - Include formula name and preparation
   - Include output expectations (wet diapers, stools per day)
   - Include weight gain targets (g/day)
   - Include alert thresholds ("Contact pediatrician if feeding <6 times in 24 hours")

10. SAFE SLEEP INSTRUCTIONS (dischargeSection.safeSleepInstructions) — for neonatal:
    - Extract COMPLETELY. This is SIDS prevention and is life-safety content.
    - Include: position, mattress, what NOT to put in crib, room-sharing guidance
    - Preserve any emphasis about premature infants being at HIGHER risk

11. WARNING SIGNS (dischargeSection.warningSignsFromDoc):
    - Extract EVERY warning sign with specific thresholds
    - Preserve exact numbers (temperature >100.4°F, breathing >60/min, etc.)
    - Keep the action instruction (call pediatrician, go to ER)

12. FOLLOW-UP APPOINTMENTS (dischargeSection.followUpStructured):
    - Extract ALL appointments with specialty, provider, date/time, purpose
    - If the document marks any as urgent/critical ("do NOT miss"), set urgency to "critical"
    - Include recurring appointments (weekly weight checks, monthly injections)

13. IMAGING & PROCEDURES (imagingAndProcedures):
    - Extract each study/procedure with date, plain-language findings, and key measurements
    - For echocardiograms: EF, valve findings, pressures
    - For X-rays: what they showed and how it changed
    - For procedures: what was done, how much fluid removed, results

14. IMMUNIZATIONS (immunizations) — especially for pediatric documents:
    - List all administered vaccines with dates
    - Include upcoming schedule
    - For specialty vaccines (Palivizumab/Synagis), include weight-based dosing and schedule

15. WOUND CARE (dischargeSection.woundCare):
    - Extract dressing type, change frequency, cleaning instructions
    - Include signs of infection to watch for

16. RESPIRATORY PRECAUTIONS (dischargeSection.respiratoryPrecautions):
    - Hand hygiene requirements, crowd avoidance, smoke exposure, visitor restrictions

17. DEVELOPMENTAL GUIDANCE (dischargeSection.developmentalGuidance):
    - Corrected vs chronological age explanation
    - Early intervention referrals
    - PT/OT evaluation timelines

18. DIAGNOSES (dischargeSection.diagnosesMentionedInDoc):
    - List ALL diagnoses: principal, secondary, comorbid, historical
    - Include staging/grading where provided (CKD Stage IV, ROP Stage 2 Zone II, etc.)

19. QUESTIONS FOR DOCTOR (questionsForDoctor):
    - Generate 5-10 questions specific to THIS patient's conditions
    - Reference specific values, medications, and findings from the document
    - For pediatric documents, frame questions for parents

20. WHAT WE COULD NOT DETERMINE (whatWeCouldNotDetermine):
    - List anything that was unclear, incomplete, or potentially redacted
    - Be specific about what's missing and why it matters

AUDIENCE DETECTION:
- If the document is a NICU/pediatric discharge, address PARENTS ("your baby") throughout
- If the document is an adult discharge, address the PATIENT ("you/your")
- If unclear, default to patient-directed language

CONFIDENCE SCORING:
- Include confidence scores (0.0-1.0) for all AI-generated content
- Higher confidence for information directly stated in the document
- Lower confidence for inferred or interpreted information
- Omit confidence score if you cannot reasonably assess it
```

### 3B. Add to `buildUserPrompt()` — discharge_summary case

```
Analyze this discharge summary comprehensively. It is a hybrid document containing both 
clinical data and patient instructions. Extract EVERYTHING — every lab value (including 
normals), every medication, every appointment, every instruction, every warning sign.

CRITICAL COMPLETENESS CHECK before returning your response:
□ Did I include ALL lab values from every table (even normal ones)?
□ Did I include ALL medications listed in the discharge medications section?
□ Did I include ALL follow-up appointments?
□ Did I include ALL warning signs with specific thresholds?
□ Did I include ALL home care instructions (diet, activity, monitoring, wound care)?
□ Did I extract imaging/procedure findings if present?
□ Did I list discontinued medications with reasons if present?
□ Did I include immunization records if present?
□ Did I include feeding plan details if this is a neonatal document?
□ Did I include safe sleep instructions if this is a neonatal document?
□ Are any [FILTERED] or [REDACTED] tokens in my output? (They should NOT be)
□ Did I use specific language instead of vague phrases?

If any checkbox fails, go back and fix it before responding.
```

### 3C. Update the `AnalyzeDocumentInput` type

```typescript
documentType: "lab_report" | "discharge_instructions" | "discharge_summary";
```

---

## Change 4: Upload Page — `src/app/upload/page.tsx`

### 4A. Add new option to the document type dropdown

```tsx
<select id="documentType" ...>
    <option value="lab_report">Lab Report</option>
    <option value="discharge_summary">Discharge Summary (Full)</option>
    <option value="discharge_instructions">Discharge Instructions (Simple)</option>
</select>
```

### 4B. (Optional enhancement) Auto-detect document type

Consider adding a hint system: if the filename contains "discharge" or "summary" or "NICU", auto-select `discharge_summary`. This reduces user error from selecting the wrong type.

---

## Change 5: Results Page — `src/app/results/page.tsx`

Update the results page to handle the new `discharge_summary` type. The page currently checks `isLabReport()` and `isDischargeInstructions()`. Add `isDischargeSummary()` handling.

### Rendering order for discharge_summary (top to bottom):

```
1. Summary (patientSummary.overallSummary + keyTakeaways)        — existing component
2. Questions for Doctor (questionsForDoctor)                      — existing component
3. ⚠️ Warning Signs (warningSignsFromDoc + generalRedFlags)       — NEW prominent section
4. 💊 Medications (medications)                                    — existing MedicationCards
5. 🚫 Discontinued Medications (discontinuedMedications)           — NEW component
6. 📋 Daily Monitoring Checklist (dailyMonitoring)                 — NEW component
7. 🍎 Diet & Nutrition (dietInstructions + feedingPlan)            — NEW component
8. 🏃 Activity & Restrictions (activityRestrictions)               — NEW component
9. 🏠 Home Care (homeCareSteps + woundCare)                       — NEW component
10. 😴 Safe Sleep (safeSleepInstructions) — if present             — NEW component (neonatal)
11. 🫁 Respiratory Precautions (respiratoryPrecautions) — if present — NEW component
12. 🧪 Lab Results (labsSection)                                   — existing LabsTable
13. 📷 Imaging & Procedures (imagingAndProcedures)                 — NEW component
14. 📅 Follow-Up Appointments (followUpStructured)                 — NEW component
15. 💉 Immunizations (immunizations) — if present                  — NEW component
16. 👶 Developmental Guidance (developmentalGuidance) — if present — NEW component
17. 📝 Diagnoses (diagnosesMentionedInDoc)                         — NEW component
18. ❓ What We Could Not Determine (whatWeCouldNotDetermine)       — existing section
```

**Design principle:** Action items first (warning signs, medications, monitoring), reference material last (labs, imaging, diagnoses). Warning signs go near the top because they're safety-critical.

### Type guard logic:

```typescript
import { isDischargeSummary, isLabReport, isDischargeInstructions } from "@/contracts/analysisSchema";

// In the render:
{isLabReport(result) && (
    // existing lab report rendering — UNCHANGED
)}

{isDischargeInstructions(result) && (
    // existing discharge instructions rendering — UNCHANGED
)}

{isDischargeSummary(result) && (
    // NEW: render ALL sections in the order above
    // Each section should check for existence before rendering:
    // {result.dischargeSection?.warningSignsFromDoc?.length > 0 && <WarningSigns ... />}
)}
```

---

## Change 6: New UI Components — `src/components/`

Create the following components. All should match the existing dark card-based design with green/red status badges.

### Required new components:

| Component | Data Source | Design Notes |
|-----------|------------|--------------|
| `WarningSigns.tsx` | `warningSignsFromDoc` + `generalRedFlags` | Red/yellow alert card, prominent placement. Show specific thresholds. |
| `DiscontinuedMeds.tsx` | `discontinuedMedications[]` | Muted/strikethrough style. Show: name (crossed out), reason, replacement. |
| `DailyMonitoring.tsx` | `dailyMonitoring[]` | Checklist format with checkboxes. Group by time of day if possible. |
| `DietCard.tsx` | `dietInstructions` + `feedingPlan` | Card with key numbers prominent (sodium limit, fluid limit, calorie target). For neonatal: volumes, frequencies, formula name. |
| `ActivityCard.tsx` | `activityRestrictions` | Card showing restrictions and rehab referrals. |
| `HomeCareSection.tsx` | `homeCareSteps[]` + `woundCare` | Step-by-step card layout. Wound care gets its own sub-card if present. |
| `SafeSleep.tsx` | `safeSleepInstructions` | High-visibility card (these are life-safety). Only renders for neonatal documents. |
| `RespiratoryPrecautions.tsx` | `respiratoryPrecautions` | Info card with hygiene/visitor/environment guidance. |
| `ImagingSection.tsx` | `imagingAndProcedures[]` | Card per study. Show name, date, plain findings, key measurements with interpretations. |
| `FollowUpTimeline.tsx` | `followUpStructured[]` | Chronological card/timeline view. Critical appointments get red badge. Show: specialty, provider, date, purpose. |
| `ImmunizationRecord.tsx` | `immunizations[]` | Table or card list. Show administered + upcoming. Highlight overdue items. |
| `DevelopmentalGuidance.tsx` | `developmentalGuidance` | Info card. Explain corrected vs chronological age. Show referral info. |
| `DiagnosesList.tsx` | `diagnosesMentionedInDoc[]` | Grouped list with staging/grading preserved. |

### Design consistency rules:
- Use the same card border radius, padding, and font sizes as existing `LabsTable` cards
- Normal/positive items: green badge
- Warning/caution items: yellow/amber badge
- Critical/urgent items: red badge
- Each card should have a clear heading and an icon/emoji prefix
- All components should handle empty/undefined data gracefully (render nothing if no data)

---

## Change 7: Update Print View — `src/app/results/print/page.tsx`

Add rendering for `isDischargeSummary(result)` that includes ALL sections in the same order as the results page. The print view already handles labs and discharge separately — add the combined view.

---

## Change 8: Update Clinician View — `src/app/clinician/review/page.tsx`

Add rendering for the new document type. The clinician view should show all the same sections but in a more compact, clinical format (terminology doesn't need to be simplified).

---

## Change 9: Update API Route — `src/app/api/analyze/route.ts`

The `RequestSchema` validates `documentType` using `DocumentTypeSchema`. Since we updated the enum in Change 1, this should work automatically. Verify the validation still passes.

Also update `MAX_TEXT_LENGTH` if needed — complex discharge summaries can exceed 50k chars when the full hospital course is included. Consider increasing to 75k or 100k.

---

## Change 10: Update Mock Data — `src/lib/ai/analyzeDocument.ts`

Add a mock response for `discharge_summary` in `getMockAnalysisResult()` that includes sample data for ALL new fields (labsSection, dischargeSection with new fields, imagingAndProcedures, discontinuedMedications, immunizations, etc.). This ensures the UI can be developed and tested without API keys.

---

## Change 11: Update Gemini Provider — `src/lib/ai/providers/gemini.ts`

The current Gemini provider concatenates system + user prompts into one string. For the much longer `discharge_summary` prompts, verify the combined prompt stays within Gemini's input limits. The current model `gemini-3-flash-preview` has a massive context window (10M tokens), so this should be fine, but log the prompt length for monitoring.

---

## Lab Extraction Completeness Rules (add to AI prompt)

These rules address the issue where 18 normal lab values were skipped in the cardiac document but all 16 were included in the NICU document (inconsistent behavior):

```
LAB EXTRACTION RULES — MANDATORY:

1. INCLUDE ALL LABS. Every single lab value in the document must appear in your output.
   Normal results are NOT optional — they provide reassurance and clinical context.

2. NEVER SKIP NORMAL RESULTS. A normal TSH matters when the patient is on amiodarone.
   A normal procalcitonin matters when the patient had suspected sepsis. A normal
   platelet count matters when the patient is on anticoagulants. Context determines
   importance, not just the flag.

3. SERIAL VALUES: When the same test appears at multiple timepoints:
   - Primary value = most recent (discharge) value
   - Explanation MUST include ALL timepoints with dates
   - State the trend direction explicitly
   - Example: "Your BNP decreased steadily during your stay: 4,280 (admission) → 3,120 
     (day 3) → 1,840 (day 5) → 980 (discharge). This improving trend indicates your 
     heart failure treatment is working, though the level remains elevated."

4. CROSS-REFERENCE RELATED LABS in explanations:
   - Iron studies: Connect iron, TIBC, TSAT, ferritin together
   - Kidney panel: Connect BUN, creatinine, eGFR, phosphorus, uric acid
   - Nutrition: Connect albumin, pre-albumin, total protein
   - Anemia: Connect Hgb, Hct, RBC, MCV, MCH, MCHC, RDW, retic count
   - Liver: Connect AST, ALT, Alk Phos, bilirubin (total + direct), GGT

5. SPECIFIC EXPLANATIONS: Never say "might be related to your condition."
   Always name the specific condition and explain the mechanism.
   - BAD: "Your high BUN might be related to your condition."
   - GOOD: "Your high BUN (48 mg/dL) reflects your kidneys' reduced ability to filter waste, 
     consistent with your Stage IV chronic kidney disease."

6. MEDICATION CONNECTIONS: When a lab is monitored because of a specific medication,
   say so:
   - "TSH is checked because amiodarone can affect thyroid function"
   - "Potassium is monitored closely because spironolactone can raise potassium levels"
   - "Liver enzymes are tracked because amiodarone and statins can both affect the liver"

7. NEONATAL REFERENCE RANGES: For infant documents, always use age-appropriate ranges.
   If a value would be abnormal in adults but normal in neonates, explicitly note this
   to prevent parental anxiety from Googling adult ranges.
```

---

## Testing Protocol

After implementing all changes, test against ALL 3 synthetic documents:

### Test 1: Cardiac + Renal Discharge Summary
Upload as "Discharge Summary (Full)". Verify:
- [ ] Summary: No [FILTERED] tokens, covers HF, AFib, AKI, DM, anemia
- [ ] Labs: ALL 49 values rendered (19 CMP + 10 CBC + 7 cardiac + 13 special)
- [ ] Labs: All 18 previously-skipped normal values now present
- [ ] Labs: Serial cardiac biomarkers show all 4 timepoints in explanations
- [ ] Labs: Explanations reference specific diagnoses and medications
- [ ] Medications: All 15 discharge meds with full details
- [ ] Discontinued Meds: Metformin, lisinopril, aspirin, amlodipine with reasons
- [ ] Follow-Up: All 8 appointments with dates/providers/purposes
- [ ] Imaging: 2 TTEs, 2 CXRs, thoracentesis, Swan-Ganz cath
- [ ] Diet: 2g sodium, 1.5L fluid, diabetic diet, 1800 kcal, protein supplements
- [ ] Activity: Light ADLs, no lifting >10 lbs, cardiac rehab referral
- [ ] Daily Monitoring: Weight (AM, before breakfast, after urinating), blood sugar (AC + HS)
- [ ] Wound Care: Sacral pressure injury — saline, hydrocolloid dressing, q3 days
- [ ] Warning Signs: Weight gain >3 lbs/24h, SOB, edema, chest pain, syncope
- [ ] Diagnoses: All 12 diagnoses with staging

### Test 2: NICU Premature Infant Discharge
Upload as "Discharge Summary (Full)". Verify:
- [ ] Summary: Addresses PARENTS, covers prematurity, all major diagnoses
- [ ] Labs: All 16 values with neonatal reference ranges
- [ ] Labs: CRP explanation references resolved sepsis (peak 42 → <1)
- [ ] Medications: Vitamin D3, iron (start 2 weeks post-d/c), multivitamin
- [ ] Feeding Plan: 8x/day breastfeeding, 60 mL NeoSure 22 kcal/oz, 150-180 mL/kg/day target
- [ ] Safe Sleep: Supine, firm mattress, no loose items, room-sharing, HIGHER SIDS risk
- [ ] Warning Signs: All 7 with specific thresholds (temp, cyanosis, tachypnea, apnea, etc.)
- [ ] Follow-Up: All 8 appointments, ophthalmology marked CRITICAL
- [ ] Immunizations: All 6 administered vaccines + Synagis + upcoming schedule
- [ ] Developmental: Corrected vs chronological age, early intervention referral, PT/OT
- [ ] Respiratory: No O₂ needed, RSV risk, hand hygiene, avoid crowds/smoke
- [ ] Diagnoses: All 12 including ROP staging, IVH grading, BPD classification

### Test 3: Oncology Surgical Discharge (if tested)
Upload as "Discharge Summary (Full)". Verify:
- [ ] Surgical pathology details translated (TNM staging, R0 margins, IHC)
- [ ] Tumor markers (CA 19-9, CEA) with pre/post-op values
- [ ] Type 3c diabetes explained differently from Type 2
- [ ] CREON dosing with meals AND snacks
- [ ] Chemo plan (modified FOLFIRINOX) mentioned as upcoming
- [ ] BRCA2 genetic counseling referral
- [ ] DVT management (rivaroxaban transition from enoxaparin)

### Backward Compatibility
- [ ] Upload a simple lab report as "Lab Report" — works exactly as before
- [ ] Upload simple discharge instructions as "Discharge Instructions" — works exactly as before
- [ ] Existing localStorage data from previous analyses still loads correctly

---

## Priority / Implementation Order

If implementing incrementally (recommended):

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Fix [FILTERED] bug (Change 2) | Small | Fixes visible patient-facing bug |
| **P0** | Schema + new type (Change 1) | Medium | Unblocks everything else |
| **P0** | AI prompt rewrite (Change 3) | Medium | Makes the AI extract everything |
| **P1** | Results page rendering (Change 5) | Medium | Makes new data visible |
| **P1** | New UI components (Change 6) | Large | Full user experience |
| **P1** | Upload page update (Change 4) | Small | Lets users select new type |
| **P2** | Print view (Change 7) | Medium | Export completeness |
| **P2** | Clinician view (Change 8) | Medium | Professional output |
| **P2** | Mock data (Change 10) | Small | Dev experience |
| **P3** | API route + Gemini provider (Changes 9, 11) | Small | Edge cases |

**Estimated total effort:** 2-3 days for a competent developer familiar with the codebase.

---

## NEW: Test Results from Output4 (Post-Schema Fix) — Live Screenshots

After the initial schema + discharge_summary type was implemented, we tested the cardiac/renal document again. The good news: the app now renders 21 pages of content instead of 8. The bad news: several critical "Unknown" field bugs and a major UX problem emerged.

### What's Now Working ✅
- All 36 lab values rendering with proper flags (normal/high/low), serial trending in explanations
- Warning signs section with two-column "When to act" / "What to do" layout
- Follow-up appointments with provider names, dates/times, purposes
- Dietary guidance and activity restrictions as distinct colored cards
- Daily monitoring checklist with interactive checkboxes
- Home care steps with wound care details
- Imaging findings extracted (though names are wrong)
- Discontinued medications section exists (though names missing)

### Critical Bugs Found

**BUG 1 (P0): All 15 medications show "Unknown Medication"**
The AI extracted the indication/purpose correctly but failed to populate the `name` field.
What the patient sees: "Unknown Medication — Heart failure with reduced ejection fraction (HFrEF)"
What they should see: "Sacubitril/Valsartan (Entresto) — Heart failure with reduced ejection fraction (HFrEF)"
This is a **patient safety issue** — patients cannot identify which card matches which pill.

**BUG 2 (P0): All 4 discontinued medications show "Unknown Medication" with "No reason specified"**
The source document clearly states: metformin (CKD contraindication), lisinopril (replaced by Entresto), aspirin (bleeding risk with Eliquis), amlodipine (hypotension). The AI extracted the replacements ("Replaced by: Empagliflozin and insulin adjustments") but not the names or reasons.

**BUG 3 (P1): All 7 imaging studies show "Unknown Imaging"**  
Should be: TTE (Admission), TTE (Day 7), CXR (Admission), CXR (Pre-discharge), Thoracentesis (Day 2), Swan-Ganz (Admission). The findings are all extracted correctly — only the name field is empty.

**BUG 4 (P1): [FILTERED] still in summary — 3 instances visible**
- "[FILTERED] severe heart failure with reduced pumping ability..."
- "[FILTERED] a new irregular heartbeat..."  
- "[FILTERED] multiple follow-up appointments scheduled..."

**BUG 5 (P2): [DOB REDACTED] in follow-up appointment dates**
Cardiac Rehab shows "[DOB REDACTED] — Intake" and Home Health shows "[DOB REDACTED] (next day)". The redaction system incorrectly classified "next day after discharge" as containing DOB data. The original document says "Next day after discharge" — no actual date of birth present.

**BUG 6 (P2): [FILTERED] in lab explanation**
MCV explanation truncated: "This is important in classifying the type of anemia [FILTERED]."

**BUG 7 (P2): Daily monitoring checklist incomplete**
Only 3 items (weight, BG, insulin) but source has 4 (missing: heart rate monitoring with Carvedilol hold rule and potassium monitoring with Spironolactone hold rule).

---

## Change 12: Fix "Unknown" Names — AI Prompt Additions

Add these explicit instructions to the AI prompt to prevent "Unknown" fallback values:

### 12A. Medication Names (add to buildSystemPrompt)

```
MEDICATION NAME EXTRACTION — CRITICAL RULE:
Every medication MUST have a name populated. Never return "Unknown Medication" or leave 
the name field empty. The source document always lists medication names.

For each medication, extract:
- name: The full medication name with both generic and brand names
  Format: "Generic Name (Brand Name)" e.g., "Sacubitril/Valsartan (Entresto)"
  If only one name is given, use that name.
- dose: The exact dose from the document (e.g., "24/26mg", "3.125mg", "40mg")
- route: PO, IV, IM, SubQ, topical, etc.
- frequency: Exact frequency (e.g., "BID", "Daily", "MWF only", "TID", "Before meals")
- purpose: Plain-language explanation of why the patient takes this medication
- instructions: Any special instructions (timing, food, hold parameters, monitoring)

NEVER use placeholder values like "Unknown", "N/A", or leave name blank.
If you cannot identify the medication name, use the class/category 
(e.g., "Beta-blocker" or "Diuretic") — but this should almost never happen 
because discharge summaries always list medication names explicitly.
```

### 12B. Discontinued Medication Names and Reasons (add to buildSystemPrompt)

```
DISCONTINUED MEDICATIONS — CRITICAL RULE:
Every discontinued medication MUST have:
- name: The specific medication name (e.g., "Metformin", "Lisinopril", "Aspirin")
  NEVER "Unknown Medication"
- reasonPlain: The plain-language reason it was stopped
  The source document ALWAYS states why medications were discontinued.
  NEVER return "No reason specified" — look for:
  * "discontinued due to..." / "held due to..."
  * "contraindicated in..." / "replaced by..."
  * Drug interactions, organ function concerns, side effects
  Common patterns:
  - "Metformin discontinued — contraindicated with eGFR < 30 (CKD)"
  - "Lisinopril stopped — replaced by Entresto (cannot take both ACEi and ARNI)"
  - "Aspirin held — bleeding risk with concurrent Eliquis (apixaban)"
  - "Amlodipine stopped — hypotension (SBP consistently < 100)"
- replacedBy: Name of the replacement medication if applicable
```

### 12C. Imaging Study Names (add to buildSystemPrompt)

```
IMAGING & PROCEDURE NAMES — CRITICAL RULE:
Every imaging study or procedure MUST have a specific name. NEVER use "Unknown Imaging"
or "Unknown Procedure". Identify the study type from the content:

- Echo findings (LVEF, wall motion, valves) → "Transthoracic Echocardiogram (TTE)"
- Chest findings (cardiomegaly, effusions, consolidation) → "Chest X-Ray (CXR)"
- Fluid removal from pleural space → "Thoracentesis"
- Swan-Ganz/hemodynamic data (RA, PA, PCWP, CO, CI) → "Right Heart Catheterization (Swan-Ganz)"
- CT findings → "CT [body part]"
- MRI findings → "MRI [body part]"
- Ultrasound → "Ultrasound [body part]" or specific (e.g., "Cranial Ultrasound")

Also extract the specific date or timing (e.g., "Admission", "Day 2", "Day 7", 
"Pre-discharge") — NEVER use [DOB REDACTED] or other redaction tokens as dates.
If the date was redacted, use the relative timing instead ("Admission", "Day 7").
```

### 12D. Redaction Token Handling — Enhanced (update to Change 2)

```
ENHANCED REDACTION RULES:
The input text uses [FILTERED] and [REDACTED] to mask personal health information.

1. NEVER include [FILTERED], [REDACTED], [DOB REDACTED], or any bracket-token in output
2. Write around redacted information naturally:
   BAD: "[FILTERED] severe heart failure..."
   GOOD: "You have severe heart failure..."
   BAD: "The type of anemia [FILTERED]"  
   GOOD: "The type of anemia you have"
   BAD: "[DOB REDACTED] — Intake"
   GOOD: "Next day after discharge — Intake" (use relative timing)
3. For dates that were redacted, substitute with relative timing:
   - "Next day after discharge" instead of "[DOB REDACTED]"
   - "2 weeks post-discharge" instead of specific redacted date
4. If a sentence becomes meaningless after removing a redaction token,
   rewrite the entire sentence rather than leaving a gap
```

---

## Change 13: UX Overhaul — Page Layout & Visual Hierarchy

### The Problem
The results page is a 21-page continuous scroll with no visual hierarchy. Every section (summary, labs, warning signs, medications, appointments) uses the same white card style with identical spacing. A patient scrolling through will:
1. Get overwhelmed by volume
2. Miss critical safety information buried on page 10+
3. Not know when they've moved from one major section to another
4. Spend most of their time on labs (pages 3-10) and never reach medications/instructions

### 13A. Section Navigation — Sticky Header or Jump Links

Add a sticky section navigator at the top of the results page (below the action buttons):

```tsx
// Sticky navigation bar with section jump links
<nav className="sticky top-0 z-10 bg-white border-b shadow-sm py-2 px-4 flex gap-4 overflow-x-auto">
    <a href="#summary" className="text-sm font-medium whitespace-nowrap">Summary</a>
    <a href="#warning-signs" className="text-sm font-medium text-red-600 whitespace-nowrap">⚠️ Warning Signs</a>
    <a href="#medications" className="text-sm font-medium whitespace-nowrap">💊 Medications</a>
    <a href="#monitoring" className="text-sm font-medium whitespace-nowrap">📋 Daily Tasks</a>
    <a href="#labs" className="text-sm font-medium whitespace-nowrap">🧪 Lab Results</a>
    <a href="#appointments" className="text-sm font-medium whitespace-nowrap">📅 Appointments</a>
    <a href="#imaging" className="text-sm font-medium whitespace-nowrap">📷 Imaging</a>
    <a href="#home-care" className="text-sm font-medium whitespace-nowrap">🏠 Home Care</a>
</nav>
```

Each section should have a corresponding `id` attribute for jump-to-section behavior.

### 13B. Re-order Sections for Patient Priority

Current order puts labs first (10+ pages of scrolling before any actionable content).
Recommended order for discharge_summary type:

```
1. Summary (1 screen)                         — Already good
2. ⚠️ WARNING SIGNS (1 screen)                — Move UP from page 10 to page 2
3. 💊 Medications (2-3 screens)               — Move UP from page 10+
   └── Discontinued Medications (sub-section)
4. 📋 Daily Monitoring Checklist (1 screen)   — Move UP
5. 🍎 Diet + Activity (1 screen)              — Already good cards
6. 🏠 Home Care + Wound Care (1-2 screens)    — Consolidate duplicates
7. 📅 Follow-Up Appointments (1 screen)       — Already good
8. 🧪 Lab Results (5-8 screens)               — Move DOWN (reference material)
9. 📷 Imaging & Procedures (2-3 screens)      — Move DOWN
10. ❓ Questions for Doctor (1 screen)         — Move to end as reference
```

**Rationale:** Action items first (what to watch for, what pills to take, daily tasks), reference material last (lab values, imaging, questions to bring to appointments).

### 13C. Section Dividers with Visual Distinction

Add colored section headers with background tints to break the visual monotony:

```css
/* Warning Signs section */
.section-warning { background: #FEF2F2; border-left: 4px solid #DC2626; }

/* Medications section */
.section-medications { background: #EFF6FF; border-left: 4px solid #2563EB; }

/* Daily Monitoring section */  
.section-monitoring { background: #FEF9C3; border-left: 4px solid #CA8A04; }

/* Lab Results section */
.section-labs { background: #F0FDF4; border-left: 4px solid #16A34A; }

/* Follow-up section */
.section-appointments { background: #F5F3FF; border-left: 4px solid #7C3AED; }
```

### 13D. Collapsible Lab Sections

Since labs take up 5-8 screens, add collapsible grouping by category:

```
▼ Metabolic Panel (CMP) — 12 values, 2 abnormal
    [expanded: shows Sodium, Potassium, Chloride, CO2, BUN, Creatinine, eGFR, 
     Glucose, Calcium, Magnesium, Phosphorus]

▼ Complete Blood Count (CBC) — 10 values, 4 abnormal  
    [expanded: shows WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, 
     RDW-CV, Platelet Count, Retic Count]

► Cardiac Biomarkers — 5 values, 2 abnormal [collapsed by default if all improving]
► Iron Studies — 6 values, 3 abnormal
► Coagulation — 5 values, 1 abnormal  
► Other — 5 values (Uric Acid, Lactic Acid, Procalcitonin, TSH, HbA1c)
```

Abnormal groups default to expanded. All-normal groups can default to collapsed with a "All normal ✅" summary line.

### 13E. Reduce Duplication

The current output repeats the same instructions in 3+ places:
- Activity restrictions appear in: Activity card, Home Care Steps, and within medication instructions
- Weight monitoring appears in: Daily Monitoring, Home Care Steps, and Furosemide medication card
- Wound care appears in: Home Care Steps and Wound & Incision Care section

**Fix:** Show each instruction ONCE in the most prominent location. Other sections should cross-reference rather than repeat. For example, the furosemide card can say "See Daily Monitoring section for weight tracking instructions" instead of repeating the full protocol.

---

## Updated Priority Table

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Fix [FILTERED] bug (Change 2 + 12D) | Small | 3+ instances in patient-facing summary |
| **P0** | Fix "Unknown Medication" names (Change 12A) | Small | **Patient safety** — can't ID pills |
| **P0** | Fix "Unknown" discontinued med names/reasons (Change 12B) | Small | Patient safety — stopped meds without reason |
| **P0** | Schema + new type (Change 1) | Medium | Already partially done |
| **P0** | AI prompt rewrite (Change 3 + 12A-D) | Medium | Makes AI populate ALL fields |
| **P1** | Fix "Unknown Imaging" names (Change 12C) | Small | Confusing but not safety-critical |
| **P1** | Section reordering (Change 13B) | Medium | Action items before reference material |
| **P1** | Section navigation (Change 13A) | Small | Fixes endless scroll problem |
| **P1** | New UI components (Change 6) | Large | Full user experience |
| **P1** | Collapsible labs (Change 13D) | Medium | Reduces scroll fatigue |
| **P2** | Section visual hierarchy (Change 13C) | Small | Polish |
| **P2** | Reduce duplication (Change 13E) | Medium | Cleaner output |
| **P2** | Print view (Change 7) | Medium | Export completeness |
| **P2** | Daily monitoring completeness (Bug 7) | Small | Missing 2 of 4 items |
| **P3** | Clinician view (Change 8) | Medium | Professional output |

**Updated estimated total effort:** 3-4 days for a competent developer.

---

## Final Note

The core insight is that MedLabLingo's AI is already smart enough to understand these complex documents — the Gemini model correctly identified clinical relationships, used neonatal reference ranges, and generated excellent patient-directed questions. The remaining problems are:

1. **Name extraction failures** — The AI populates the "purpose/indication" field but leaves the "name" field empty for medications, discontinued meds, and imaging studies. This is likely a schema field naming issue or a prompt ambiguity where the AI doesn't know which field should get the name.

2. **Redaction token leakage** — The three-layer fix (redact.ts, AI prompt instruction, safetyFilter.ts post-processing) needs full implementation. The `[FILTERED]` and `[DOB REDACTED]` tokens are appearing in 5+ places in the output.

3. **UX hierarchy** — The content is all there now (21 pages!), but it's presented as an undifferentiated wall. Reordering sections, adding navigation, and collapsing reference material will transform it from "data dump" to "patient guide."

Fix these three things and MedLabLingo becomes a genuinely useful clinical translation tool.
