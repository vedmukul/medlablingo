# LabLingo Deployment Guide

Complete checklist and troubleshooting guide for deploying LabLingo to Vercel.

## Pre-Deployment Checklist

### ✅ Code Quality

- [ ] All tests pass locally
  ```bash
  npm test
  ```

- [ ] Production build succeeds
  ```bash
  npm run build
  ```

- [ ] No TypeScript errors
  ```bash
  npx tsc --noEmit
  ```

- [ ] Lint checks pass
  ```bash
  npm run lint
  ```

### ✅ Environment Configuration

- [ ] `.env.example` is up to date with all required variables
- [ ] `.env.local` is in `.gitignore` (verify it won't be committed)
- [ ] Decide whether to deploy with or without `OPENAI_API_KEY`
  - **Without key**: Mock mode (free, safe for demos)
  - **With key**: Real AI analysis (costs apply, review OpenAI pricing)

### ✅ Security Review

- [ ] No hardcoded secrets in source code
- [ ] No PHI/PII in logs (verify `logger.ts` sanitization)
- [ ] Rate limiting is enabled (`rateLimiter.ts`)
- [ ] Safety filters are active (`safetyFilter.ts`, `redact.ts`)
- [ ] Disclaimers are visible on all pages

## Vercel Deployment Steps

### 1. Prepare Repository

```bash
# Initialize git (if not already done)
git init

# Review what will be committed
git status

# Ensure .env.local is NOT listed
# If it appears, add it to .gitignore immediately

# Commit your code
git add .
git commit -m "Prepare for Vercel deployment"

# Push to GitHub
git remote add origin https://github.com/yourusername/lablingo.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Vercel will auto-detect Next.js settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables (Optional)

**For mock mode deployment** (recommended for demos):
- Skip this step entirely
- App will run in mock mode automatically

**For real AI analysis**:
1. In Vercel dashboard → Your Project → Settings → Environment Variables
2. Add variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-...` (your OpenAI API key)
   - **Environment**: Production (and Preview if desired)
3. Click "Save"

### 4. Deploy

1. Click "Deploy" button
2. Wait for build to complete (typically 1-2 minutes)
3. Note your deployment URL: `https://your-project.vercel.app`

## Post-Deployment Verification

### ✅ Health Check

Test the health endpoint to verify the deployment is live:

```bash
curl https://your-project.vercel.app/api/health
```

**Expected response:**
```json
{
  "ok": true,
  "version": "0.1.0",
  "time": "2026-01-11T...",
  "requestId": "..."
}
```

### ✅ Smoke Test

1. **Visit landing page**
   - Navigate to `https://your-project.vercel.app`
   - Verify page loads without errors
   - Check disclaimers are visible

2. **Test upload flow**
   - Click "Get Started" or navigate to `/upload`
   - Upload a sample PDF (lab report or discharge instructions)
   - Select document type and reading level
   - Submit form

3. **Verify results page**
   - Results should display within 5-10 seconds
   - In mock mode: See sample analysis data
   - In real mode: See AI-generated analysis
   - Check that all UI sections render correctly

4. **Test data retention**
   - Revisit `/results` — data should persist (localStorage)
   - Clear browser localStorage
   - Revisit `/results` — should show "no analysis found"

### ✅ Monitoring Setup

1. **Vercel Dashboard**
   - Check "Logs" tab for any errors
   - Monitor "Analytics" for traffic

2. **Error Tracking** (optional)
   - Consider adding Sentry or similar
   - Monitor for client-side errors

## Troubleshooting

### Build Fails on Vercel

**Symptom**: Build logs show TypeScript or dependency errors

**Solutions**:
1. Verify build works locally: `npm run build`
2. Check Node.js version in Vercel settings (should be 20.x)
3. Review build logs for specific errors
4. Ensure `package-lock.json` is committed

### API Routes Return 500 Error

**Symptom**: `/api/analyze` or `/api/health` return Internal Server Error

**Solutions**:
1. Check Vercel function logs in dashboard
2. Verify `export const runtime = "nodejs"` is present in API routes
3. Test locally with production build: `npm run build && npm start`
4. Check for missing environment variables (if using real AI mode)

### Mock Mode Not Working

**Symptom**: App throws errors when `OPENAI_API_KEY` is missing

**Solutions**:
1. Verify `analyzeDocument` function has mock fallback
2. Check `src/lib/ai/index.ts` for proper conditional logic
3. Review browser console for specific errors

### PDF Upload Fails

**Symptom**: File upload returns "Text extraction failed"

**Solutions**:
1. Verify PDF is text-selectable (not scanned image)
2. Check Vercel function size limits (50MB default)
3. Test with a simple text PDF
4. Review Vercel logs for `pdf-parse` errors

### Rate Limiting Too Aggressive

**Symptom**: Users get "Too many requests" errors frequently

**Solutions**:
1. Adjust limits in `src/lib/observability/rateLimiter.ts`
2. Consider IP-based exemptions for testing
3. Add clear retry-after messaging in UI

### Health Endpoint Returns 404

**Symptom**: `/api/health` not found

**Solutions**:
1. Verify `src/app/api/health/route.ts` exists
2. Check file is committed to repository
3. Trigger manual redeployment in Vercel

## Rollback Procedure

If deployment has critical issues:

1. **Instant rollback**:
   - Vercel Dashboard → Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Code revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```
   Vercel auto-deploys the reverted commit

## Production Considerations

### ⚠️ Important Limitations

- **Not HIPAA compliant** — do not use for protected health information
- **Not medical advice** — clearly communicate educational purpose only
- **No authentication** — all uploads are anonymous
- **Client-side storage** — analysis results stored in browser only
- **24-hour retention** — localStorage data expires automatically

### 🔒 Security Recommendations

- Review OpenAI's [data usage policies](https://openai.com/policies/usage-policies)
- Monitor rate limiting and adjust as needed
- Regularly audit logs for PHI leaks (none expected, but verify)
- Keep dependencies updated for security patches
- Consider adding authentication for production use

### 📊 Monitoring Recommendations

- Set up uptime monitoring (e.g., UptimeRobot, Vercel monitoring)
- Track health endpoint: `GET /api/health`
- Monitor error rates in Vercel dashboard
- Review function execution times (should be <10s for analysis)

## Support & Maintenance

### Regular Maintenance

```bash
# Update dependencies (monthly)
npm update
npm audit fix

# Test after updates
npm test
npm run build
```

### Useful Commands

```bash
# View production logs
vercel logs your-project.vercel.app

# Deploy preview (test branch)
git checkout -b test-feature
git push origin test-feature
# Vercel creates preview deployment automatically

# Manual deployment
vercel --prod
```

## Getting Help

- **Vercel Issues**: [Vercel Support](https://vercel.com/support)
- **Next.js Issues**: [Next.js Discussions](https://github.com/vercel/next.js/discussions)
- **Project Issues**: Open GitHub issue in your repository

---

**Last Updated**: 2026-01-11  
**Version**: 0.1.0
