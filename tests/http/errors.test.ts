import { describe, expect, it } from 'vitest';
import { ApiError, normalizeError } from '../../src/http/errors.js';

function res(status: number, body: unknown, ok = false): Response {
  return {
    ok,
    status,
    async json() { return body; },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  } as unknown as Response;
}

describe('normalizeError', () => {
  it('maps a JSON error body with message + code', async () => {
    const err = await normalizeError(res(400, { code: 'bad_input', message: 'Invalid' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('bad_input');
    expect(err.message).toBe('Invalid');
  });

  it('extracts fieldErrors', async () => {
    const err = await normalizeError(res(422, {
      message: 'Validation failed',
      fieldErrors: { name: ['too short'] },
    }));
    expect(err.fieldErrors).toEqual({ name: ['too short'] });
  });

  it('falls back to status text when body is not JSON', async () => {
    const bad = {
      ok: false,
      status: 500,
      async json() { throw new Error('not json'); },
      async text() { return 'Internal Server Error'; },
    } as unknown as Response;
    const err = await normalizeError(bad);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Internal Server Error');
  });

  it('detects FastAPI-style detail arrays as fieldErrors', async () => {
    const err = await normalizeError(res(422, {
      detail: [
        { loc: ['body', 'name'], msg: 'field required', type: 'value_error.missing' },
        { loc: ['body', 'qty'], msg: 'must be positive', type: 'value_error' },
      ],
    }));
    expect(err.status).toBe(422);
    expect(err.fieldErrors).toEqual({ name: ['field required'], qty: ['must be positive'] });
  });

  it('is a real Error with the status in the message when nothing else', async () => {
    const err = await normalizeError(res(404, {}));
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('404');
  });
});
