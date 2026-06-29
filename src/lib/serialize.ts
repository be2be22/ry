/**
 * BigInt serialization helpers.
 *
 * Prisma returns BigInt for BigInt columns, but JSON.stringify cannot serialize
 * BigInt natively. We convert BigInt values to Numbers when they fit within
 * JavaScript's safe integer range, otherwise to Strings.
 */

const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER; // 2^53 - 1

/**
 * Convert a BigInt to a Number if safe, otherwise to a String.
 */
export function bigIntToJSON(value: bigint | null | undefined): number | string | null {
  if (value === null || value === undefined) return null;
  if (value <= MAX_SAFE_INT) return Number(value);
  return value.toString();
}

/**
 * Convert a value (number, string, or bigint) to a BigInt for database storage.
 */
export function toBigInt(value: number | string | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

/**
 * Recursively convert any BigInt values in an object to JSON-safe values.
 * Also converts Date objects to ISO strings for consistent serialization.
 */
export function serializeForJSON<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return bigIntToJSON(obj) as unknown as T;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeForJSON) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = serializeForJSON((obj as Record<string, unknown>)[key]);
    }
    return result as unknown as T;
  }
  return obj;
}

/**
 * Convert a BigInt byte count to a human-readable string.
 */
export function formatBigIntBytes(bytes: bigint | number | null | undefined): string {
  if (!bytes) return "۰ بایت";
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  return formatBytesNumber(num);
}

function formatBytesNumber(bytes: number): string {
  if (bytes === 0) return "۰ بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}
