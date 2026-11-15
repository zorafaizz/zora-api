import crypto from "node:crypto";
export const opaque = () => crypto.randomBytes(32).toString("base64url");
export const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const mac = (key, ...parts) =>
  crypto.createHmac("sha256", key).update(JSON.stringify(parts)).digest("hex");
export const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const code = () =>
  String(crypto.randomInt(0, 100000000)).padStart(8, "0");
export const uuid = () => crypto.randomUUID();
export const validId = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function normalizeEmail(value) {
  if (typeof value !== "string" || value.length > 255) return null;
  const email = value.trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(
    email,
  ) && email.length <= 254
    ? email
    : null;
}
