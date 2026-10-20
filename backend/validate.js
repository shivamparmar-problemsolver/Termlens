const MIN_POLICY_CHARS = 80;
const MAX_POLICY_CHARS = 60000;
const MAX_BODY_BYTES = 2_000_000;
const ALLOWED_POLICY_TYPES = new Set([
  "privacy_policy",
  "terms",
  "cookie_policy",
  "privacy_and_terms",
  "unknown",
  "none"
]);

function redactSecrets(value) {
  return String(value || "")
    .replace(/AIza[0-9A-Za-z_-]{8,}/g, "[redacted]")
    .replace(/(api[_-]?key)(["']?\s*[:=]\s*["']?)[^"'\s&]+/gi, "$1$2[redacted]")
    .replace(/key=[^&\s]+/gi, "key=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

function asSafeError(error) {
  const status = Number(error?.status || 0);
  const raw = redactSecrets(error?.message || error || "Request failed.");
  if (status === 429 || /RESOURCE_EXHAUSTED|rate[- ]limit/i.test(raw)) {
    return { status, code: "RATE_LIMITED", message: "The Gemini API is rate-limited right now." };
  }
  if (status === 401 || status === 403) {
    return { status, code: "AUTH", message: "Gemini rejected the backend credentials." };
  }
  if (status === 404) {
    return { status, code: "MODEL", message: "The configured Gemini model was not found." };
  }
  if (error?.name === "AbortError" || /timeout/i.test(raw)) {
    return { status, code: "TIMEOUT", message: "The Gemini API timed out." };
  }
  return { status, code: "UNAVAILABLE", message: "The Gemini API was unavailable." };
}

function isRetryableGeminiError(error) {
  const safe = asSafeError(error);
  return ["RATE_LIMITED", "TIMEOUT", "UNAVAILABLE", "AUTH", "MODEL"].includes(safe.code);
}

function validatePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Request body must be a JSON object.");
    error.status = 400;
    throw error;
  }

  const text = String(input.text || "").trim();
  if (text.length < MIN_POLICY_CHARS) {
    const error = new Error("Policy text was too short to analyze.");
    error.status = 400;
    throw error;
  }
  if (text.length > MAX_POLICY_CHARS) {
    const error = new Error(`Policy text exceeds the ${MAX_POLICY_CHARS} character limit.`);
    error.status = 413;
    throw error;
  }

  const policyType = ALLOWED_POLICY_TYPES.has(input.policyType) ? input.policyType : "unknown";

  return {
    url: String(input.url || "").slice(0, 2000),
    title: String(input.title || "").slice(0, 300),
    policyType,
    text
  };
}

module.exports = {
  MIN_POLICY_CHARS,
  MAX_POLICY_CHARS,
  MAX_BODY_BYTES,
  redactSecrets,
  asSafeError,
  isRetryableGeminiError,
  validatePayload
};
