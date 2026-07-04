export interface ApiErrorShape {
  status: number;
  code?: string;
  message: string;
  /** Field-path → messages; maps to `fm.applyServerErrors`. */
  fieldErrors?: Record<string, string[]>;
  cause?: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly cause?: unknown;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.status = shape.status;
    this.code = shape.code;
    this.fieldErrors = shape.fieldErrors;
    this.cause = shape.cause;
  }
}

interface FastApiDetailItem {
  loc?: unknown[];
  msg?: string;
}

/** FastAPI/pydantic emit `{ detail: [{ loc, msg, type }] }` — fold into fieldErrors. */
function detailToFieldErrors(detail: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(detail)) return undefined;
  const out: Record<string, string[]> = {};
  for (const item of detail as FastApiDetailItem[]) {
    if (!item || !Array.isArray(item.loc)) continue;
    // Drop a leading 'body' / 'query' / 'path' segment; join the rest.
    const loc = item.loc.slice(1).length ? item.loc.slice(1) : item.loc;
    const key = loc.map(String).join('.');
    (out[key] ??= []).push(item.msg ?? 'invalid');
  }
  return Object.keys(out).length ? out : undefined;
}

/** Normalizes a non-ok `Response` into an `ApiError`. Never throws. */
export async function normalizeError(response: Response): Promise<ApiError> {
  const status = response.status;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    let text = '';
    try { text = await response.text(); } catch { /* ignore */ }
    return new ApiError({ status, message: text || `HTTP ${status}` });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const fieldErrors =
    (b.fieldErrors as Record<string, string[]> | undefined) ??
    detailToFieldErrors(b.detail);
  const message =
    (typeof b.message === 'string' && b.message) ||
    (typeof b.detail === 'string' && b.detail) ||
    `HTTP ${status}`;

  return new ApiError({
    status,
    code: typeof b.code === 'string' ? b.code : undefined,
    message,
    fieldErrors,
    cause: body,
  });
}
