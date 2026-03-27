// src/app/api/health/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Ensure we run on Node.js runtime for crypto APIs
export const runtime = "nodejs";

/**
 * Health check endpoint for monitoring and deployment verification.
 * 
 * Returns:
 * - ok: true (always, if endpoint is reachable)
 * - version: package version
 * - time: current ISO timestamp
 * - requestId: unique request identifier
 * 
 * No authentication required. No PHI/PII exposure.
 */
export async function GET() {
    const requestId = randomUUID();
    const time = new Date().toISOString();

    const response = NextResponse.json({
        ok: true,
        version: "0.1.0",
        time,
        requestId,
    });

    response.headers.set("x-request-id", requestId);

    return response;
}
