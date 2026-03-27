# Development Context — LabLingo

**Last updated:** 2026-02-07
**Session summary:** Extensive debugging of AI response parsing, UI enhancements, feature additions, and startup pitch preparation.

---

## What LabLingo Is

A Next.js (v15) web app that takes medical documents (lab reports, discharge instructions) as PDF uploads, sends the extracted text to an AI provider (after PII redaction), and returns a simplified, patient-friendly analysis. It includes an interactive chatbot for follow-up questions and a translation feature.

---

## What We Did (Chronological)

### 1. Project Context Review
- Read and understood the full codebase: `README.md`, `package.json`, `AGENT_RULES.md`, all major source files.

### 2. AI Response Parsing — Major Debugging Arc
The core issue: AI providers (Claude, then Gemini) returned JSON that didn't match the strict Zod schema (`analysisSchema.ts`). This caused repeated `invalid_union` validation errors.

**Fixes applied to `src/lib/ai/analyzeDocument.ts`:**

- **Zod v4 compatibility:** Changed `validationError.errors` → `.issues ?? .errors` in `buildRetryPrompt` (Zod v4 uses `.issues`).
- **`postProcessResponse` function:** Created a comprehensive post-processor that:
  - Force-overrides `meta` fields (`documentType`, `readingLevel`, `provenance.source`, `schemaVersion`) with known input values (Claude kept inventing wrong enum values).
  - Normalizes `safety` fields (e.g., converts `disclaimers` array → `disclaimer` string).
  - Uses `findByAlias` helper to map aliased field names from AI output to schema-expected names (e.g., `testName` → `name`, `result` → `value`).
  - `findFirstArray` helper finds array data even under unexpected keys.
  - Guarantees required sections exist (`labsSection` or `dischargeSection`) with fallback minimal data.
- **Lab item field normalization (latest fix):** Each lab item field now checks multiple aliases:
  - `name` ← `testName`, `test_name`, `parameter`, etc.
  - `value` ← `result`, `testValue`, `measured`, etc.
  - `flag` / `importance` ← normalized to valid enum values via `normalizeEnum` helper.
  - Missing fields get safe defaults (`"Unknown"`, `"N/A"`, `null`, `"unknown"`).
- **`undefined` literal fix:** Added pre-parse `replace(/:\s*undefined\b/g, ": null")` because Gemini writes literal JS `undefined` in JSON output.
- **Truncated JSON auto-repair:** Counts unmatched `{` vs `}` and attempts to close them.
- **Prompt updates:** Changed "set X section to undefined" → "Do NOT include X section at all" to prevent Gemini from writing `undefined`.
- **Verbose error logging:** Added last-300-chars log, parse error details, and post-processed shape logging.

### 3. AI Provider Configuration
**`src/lib/ai/providers/resolve.ts`:**
- Reordered priority: Google → Anthropic → OpenAI (was Anthropic-first).
- Updated Gemini model name to `gemini-2.5-flash`.

**`src/lib/ai/providers/gemini.ts`:**
- Model changed: `gemini-3-flash-preview` → `gemini-2.5-flash` (old model was deprecated).
- Added `thinkingConfig: { thinkingBudget: 0 }` to disable Gemini's internal reasoning (was causing slow responses and non-JSON output).
- Added `extractJson` method for robust JSON extraction from Gemini responses.

**`src/lib/ai/providers/claude.ts`:**
- Bumped `max_tokens` from 4096 → 8192 to prevent response truncation on retries.

**`.env.local`:**
- Added user's Google AI API key, kept Claude key, made Google primary.

### 4. Chatbot Improvements
**`src/components/AnalysisChat.tsx`:**
- Implemented `renderMarkdown` function: converts `**bold**`, `*italic*`, and lists to proper HTML instead of raw markdown text.
- Removed fixed height so it fills its container.

**`src/app/api/chat/route.ts`:**
- Rewrote `buildSystemPrompt` to be friendly, patient-centric, and directly explain medical concepts in plain language.
- AI no longer deflects every question with "ask your doctor" — only defers for personal medical judgment.

**`src/app/results/page.tsx`:**
- Moved chatbot to a fixed sticky sidebar on the right side (380px wide).
- Added open/close toggle button (floating indigo bubble when closed).
- Main content shifts left when chat is open (`lg:mr-[380px]`).
- Fixed React Hooks order violation (moved `useState(chatOpen)` above early returns).

### 5. Translation Feature (New)
**`src/app/api/translate/route.ts` (new file):**
- API endpoint that translates JSON text values from English to a target language.
- Supports 15 languages.
- Uses the resolved AI provider.

**`src/components/TranslateButton.tsx` (new file):**
- Dropdown UI for language selection.
- Extracts translatable text from analysis results and calls the translate API.

**`src/app/results/page.tsx`:**
- Integrated `TranslateButton` with state management for translated content display.

### 6. Startup Pitch Documents (New Files)
- **`STARTUP_PITCH.md`:** Full startup pitch — problem, solution, features, market, tech, business model, roadmap, team, funding ask.
- **`EMAIL_PITCH.md`:** Four email templates for investors, hospital leads, insurers/employers, and warm referrals.

---

## Key Files Modified

| File | What Changed |
|------|-------------|
| `src/lib/ai/analyzeDocument.ts` | Post-processing, alias resolution, enum normalization, JSON repair, logging |
| `src/lib/ai/providers/gemini.ts` | Model update, thinking disabled, extractJson added |
| `src/lib/ai/providers/claude.ts` | max_tokens bumped to 8192 |
| `src/lib/ai/providers/resolve.ts` | Provider priority reordered, model name updated |
| `src/components/AnalysisChat.tsx` | Markdown rendering, flexible height |
| `src/app/api/chat/route.ts` | Friendlier, patient-centric system prompt |
| `src/app/results/page.tsx` | Sidebar chat, translation integration, hooks fix |
| `.env.local` | Google AI API key added |

## New Files Created

| File | Purpose |
|------|---------|
| `src/app/api/translate/route.ts` | Translation API endpoint |
| `src/components/TranslateButton.tsx` | Translation UI component |
| `STARTUP_PITCH.md` | Startup pitch document |
| `EMAIL_PITCH.md` | Email pitch templates |

---

## Current State & Known Status

- **Server:** Next.js dev server was running (may need restart).
- **Primary AI provider:** Google Gemini 2.5 Flash (with thinking disabled).
- **Fallback providers:** Anthropic Claude Sonnet 4.5, OpenAI GPT-4o-mini.
- **Last issue worked on:** Lab item field names from Gemini not matching schema — fixed with alias-based normalization and `normalizeEnum` helper.
- **Potential remaining issue:** If Gemini returns lab items with deeply nested or radically different structure than expected, the alias mapping may need additional entries. Monitor the `[analyzeDocument] Post-processed shape` log for clues.

---

## Architecture Quick Reference

```
Upload (PDF) → API Route (/api/analyze)
  → pdf-parse (text extraction)
  → PII redaction (regex-based)
  → AI provider call (Gemini → Claude → OpenAI fallback)
  → postProcessResponse (field normalization, alias mapping, enum fixing)
  → Zod validation (analysisSchema.ts — strict mode)
  → Response to client → localStorage (24h TTL, no server storage)

Chat (/api/chat) → uses analysis result as context → AI provider → friendly response
Translate (/api/translate) → AI provider → translated JSON values
```
