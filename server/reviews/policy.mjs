import { QUOTE_CATEGORIES } from "../../js/quote-categories.mjs";
import { PROJECTS } from "../../js/project-data.mjs";
export const CONSENT_VERSION = "reviews-2026-10-19-v1";
export const MAX_BYTES = 10 * 1024 * 1024;
export const CATEGORIES = QUOTE_CATEGORIES;
// Keep existing database associations; a portfolio addition does not migrate D1.
export const PROJECT_OPTIONS = PROJECTS.filter(
  (project) => project.websiteReviewAssociation !== false,
).map(({ id, title }) => ({ id, title }));
export class ReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function text(value, max, required = false, multiline = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
    (!multiline && /[\r\n]/.test(value))
  )
    throw new ReviewError("Please check the submitted fields.");
  const result = value.trim();
  if (required && !result)
    throw new ReviewError("Complete all required fields.");
  return result;
}
export const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export function validateReview(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ReviewError("Invalid submission.");
  const name = text(body.name, 100, true),
    email = text(body.email ?? "", 254),
    review = text(body.review, 2000, true, true),
    category = text(body.category ?? "", 50);
  if (review.length < 20)
    throw new ReviewError("Please write at least 20 characters.");
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
    throw new ReviewError("Choose a rating from 1 to 5.");
  if (email && !/^[^\s<>@]+@[^\s<>@]+\.[A-Za-z]{2,}$/.test(email))
    throw new ReviewError("Enter a valid email address.");
  if (category && !CATEGORIES.some((c) => c.id === category))
    throw new ReviewError("Choose a listed service category.");
  if (body.consent !== true || body.consentVersion !== CONSENT_VERSION)
    throw new ReviewError(
      "Public review consent is required. Please reload if the notice has changed.",
    );
  if (
    !Number.isInteger(body.photoCount) ||
    body.photoCount < 0 ||
    body.photoCount > 5
  )
    throw new ReviewError("Select up to 5 photographs.");
  if (body.photoCount && body.photoConsent !== true)
    throw new ReviewError("Photograph permission is required.");
  if (!uuid(body.requestId) || body.website)
    throw new ReviewError("Invalid submission.");
  return {
    name,
    email,
    review,
    category,
    rating: body.rating,
    photoCount: body.photoCount,
    photoConsent: body.photoConsent === true,
  };
}
export async function hmac(secret, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function readBytes(request, max) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ReviewError("File or request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError("Request body is required.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new ReviewError("File or request is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of chunks) {
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
}
export async function readJSON(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ReviewError("Use a JSON request.");
  try {
    return JSON.parse(
      new TextDecoder().decode(await readBytes(request, 16384)),
    );
  } catch (e) {
    if (e instanceof ReviewError) throw e;
    throw new ReviewError("Invalid JSON.");
  }
}
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
