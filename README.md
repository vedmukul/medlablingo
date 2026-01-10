# LabLingo

Educational tool for understanding healthcare documents. **Not medical advice. Not HIPAA compliant.**

## Local setup
1. `npm install`
2. `npm run dev`

## Data Handling & Safety

### Educational Use Only ⚠️

LabLingo is an **educational demonstration** for helping patients understand their medical documents. It is:
- **NOT a medical device**
- **NOT HIPAA compliant**
- **NOT suitable for production healthcare use**
- **NOT a substitute for professional medical advice**

Always consult with qualified healthcare providers for medical decisions.

### What Data is Stored

**Browser localStorage only** (no server storage):
- Analysis results are stored in your browser's localStorage
- **Retention period**: 24 hours (automatic deletion after TTL expires)
- **Storage location**: Your device only
- **No cloud backup**: Clearing browser data deletes everything

**What is NOT stored**:
- Full extracted document text
- Original uploaded PDF files
- Any data on our servers (processing happens in API routes, nothing persists)

### What is Sent to the LLM

Before any text is analyzed by AI:
1. **Redaction is applied** to remove:
   - Email addresses
   - Phone numbers
   - Dates of birth
   - Medical record numbers (MRN)
   - Social Security numbers
   - Simple street addresses

2. **Only redacted text** is sent to OpenAI for analysis
3. **Safety filtering** removes unsafe medical advice from results
4. **No PHI logging**: Error logs never include document content

### How to Delete Your Data

Two ways to clear stored analysis:
1. **Manual**: Click "Clear saved" button on `/results` or `/clinician/review` pages
2. **Automatic**: Data expires after 24 hours

You can also clear browser localStorage directly via DevTools.

### Limitations & Disclaimers

**Redaction is "best effort"**:
- May not catch all PHI patterns
- Complex or unusual formats may slip through
- Do not rely on this for true de-identification

**Security considerations**:
- localStorage is accessible via browser DevTools
- Anyone with access to your device can view stored data
- Use in a private browsing session for sensitive documents

**Not suitable for**:
- Production healthcare environments
- HIPAA-regulated workflows
- Clinical decision-making
- Patient care delivery

### Questions or Concerns?

This is a demo project. For production healthcare document processing, consult compliance and security experts, and use certified HIPAA-compliant solutions.

## Safety disclaimer
- Educational only, not medical advice.

## Privacy disclaimer
- Uploaded documents are not stored by default.
