/**
 * Lightweight input validation helpers — no external dep.
 * Use to validate API payloads and produce { ok: true, value } | { ok: false, error }.
 */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function requireString(value: unknown, field: string, opts: { max?: number; trim?: boolean } = {}): ValidationResult<string> {
  if (typeof value !== "string") return { ok: false, error: `${field} must be a string` };
  const v = opts.trim === false ? value : value.trim();
  if (!v) return { ok: false, error: `${field} is required` };
  if (opts.max && v.length > opts.max) return { ok: false, error: `${field} too long (max ${opts.max})` };
  return { ok: true, value: v };
}

export function optionalString(value: unknown, field: string, opts: { max?: number } = {}): ValidationResult<string | undefined> {
  if (value === undefined || value === null || value === "") return { ok: true, value: undefined };
  if (typeof value !== "string") return { ok: false, error: `${field} must be a string` };
  if (opts.max && value.length > opts.max) return { ok: false, error: `${field} too long (max ${opts.max})` };
  return { ok: true, value };
}

export function requireEmail(value: unknown, field: string): ValidationResult<string> {
  const s = requireString(value, field);
  if (!s.ok) return s;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.value)) return { ok: false, error: `${field} must be a valid email` };
  return s;
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): ValidationResult<T> {
  if (!allowed.includes(value as T)) {
    return { ok: false, error: `${field} must be one of: ${allowed.join(", ")}` };
  }
  return { ok: true, value: value as T };
}

export function requireDate(value: unknown, field: string): ValidationResult<Date> {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return { ok: false, error: `${field} must be a date string or Date` };
  }
  const d = new Date(value as string | Date);
  if (Number.isNaN(d.getTime())) return { ok: false, error: `${field} is not a valid date` };
  return { ok: true, value: d };
}

export function unwrap<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
