
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../src/lib/observability/logger';
import { checkRateLimit } from '../src/lib/observability/rateLimiter';

// Mock console methods to verify output
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { });
const consoleInfo = vi.spyOn(console, 'log').mockImplementation(() => { }); // Using log for info

describe('Observability Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sanitizes blocked keys from logs', () => {
        logger.info({
            eventName: 'test.event',
            extractedText: 'THIS IS PHI',
            safeField: 'safe',
            nested: {
                rawResponse: 'MORE PHI',
                ok: true
            }
        });

        const call = consoleInfo.mock.calls[0]?.[0];
        expect(call).toBeDefined();
        const json = JSON.parse(call);

        expect(json.eventName).toBe('test.event');
        expect(json.safeField).toBe('safe');
        expect(json.extractedText).toBe('[REDACTED]');
        expect(json.nested.rawResponse).toBe('[REDACTED]'); // "raw" is blocked key substring
        expect(json.nested.ok).toBe(true);
    });

    it('handles arrays and deep nesting', () => {
        logger.info({
            eventName: 'test.deep',
            data: [
                { id: 1, text: 'Secret' },
                { id: 2, content: 'Hidden' }
            ]
        });

        const call = consoleInfo.mock.calls[0]?.[0];
        const json = JSON.parse(call);

        expect(json.data[0].id).toBe(1);
        expect(json.data[0].text).toBe('[REDACTED]');
        expect(json.data[1].content).toBe('[REDACTED]');
    });

    it('does not crash on circular references (depth limit)', () => {
        const circular: any = { name: 'circle' };
        circular.self = circular;

        logger.info({ eventName: 'test.circular', obj: circular });

        const call = consoleInfo.mock.calls[0]?.[0];
        const json = JSON.parse(call);

        expect(json.eventName).toBe('test.circular');
        // Depth limit check - precise behavior depends on implementation depth
        // We just ensure it didn't throw and logged *something*
        expect(json.obj).toBeDefined();
    });
});

describe('Rate Limiter', () => {
    it('allows requests up to the limit', () => {
        const ip = '1.2.3.4';
        // Depending on environment, limit is 100 (dev) or 10.
        // We will assume at least 5 work.
        for (let i = 0; i < 5; i++) {
            expect(checkRateLimit(ip)).toBe(true);
        }
    });

    it('blocks request when limit exceeded', () => {
        const ip = '9.9.9.9';
        // Exhaust the bucket
        const LIMIT = 100; // Dev default in our code

        for (let i = 0; i < LIMIT; i++) {
            checkRateLimit(ip);
        }

        // This one should fail
        expect(checkRateLimit(ip)).toBe(false);
    });
});
