# LabLingo

Educational tool for understanding healthcare documents. **Not medical advice. Not HIPAA compliant.**

## Local Setup

### Prerequisites
- Node.js 20+ and npm
- A PDF file for testing (lab report or discharge instructions)

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables** (optional)
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key if you want real AI analysis:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   ```
   
   **Note**: If you skip this step, the app runs in **mock mode** with realistic sample data.

3. **Start development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | _(mock mode)_ | OpenAI API key for AI analysis. If not set, returns realistic mock data. |

**Mock Mode**: When `OPENAI_API_KEY` is not configured, the app functions fully with sample analysis results. Perfect for development and testing without API costs.

### Running Tests

LabLingo includes comprehensive test suites for safety, observability, compliance, and AI integration:

```bash
# Run all tests
npm test

# Individual test suites
npm run test:safety         # Redaction and safety filtering
npm run test:observability  # Logging and rate limiting
npm run test:compliance     # Audit trail and data retention
npm run test:ai-smoke       # AI integration (requires OPENAI_API_KEY)
```

**Note**: AI smoke tests require a valid `OPENAI_API_KEY` in `.env.local`. All other tests work without it.

### Building for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Deploying to Vercel

LabLingo is optimized for deployment on Vercel with zero configuration.

### Quick Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/lablingo.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Visit [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel auto-detects Next.js configuration

3. **Configure environment variables** (optional)
   - In Vercel dashboard → Settings → Environment Variables
   - Add `OPENAI_API_KEY` if you want real AI analysis
   - Leave empty for mock mode (works great for demos!)

4. **Deploy**
   - Click "Deploy"
   - Vercel builds and deploys automatically
   - Your app is live at `your-project.vercel.app`

### Post-Deployment Verification

After deployment, verify your app is working:

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Expected response:
# {"ok":true,"version":"0.1.0","time":"2026-01-11T...","requestId":"..."}
```

Test the full flow:
1. Visit your deployed URL
2. Upload a sample PDF
3. Select document type and reading level
4. Verify analysis results display correctly

### Deployment Checklist

For a comprehensive deployment guide, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Environment & Runtime

- **Next.js**: 15.1.3 (App Router)
- **Runtime**: Node.js (required for `crypto`, `Buffer`, and `pdf-parse`)
- **Hosting**: Optimized for Vercel (works on any Node.js host)

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
