export const PROXY_HOST = "127.0.0.1";
export const PROXY_PORT = 8765;
export const PROXY_MODEL = "deepseek-chat";
export const PROXY_TIMEOUT_MS = 10000;
export const PROXY_MAX_BODY_BYTES = 32000;

export function isLocalHostHeader(host) {
  return (
    typeof host === "string" &&
    (host === `${PROXY_HOST}:${PROXY_PORT}` || host === `localhost:${PROXY_PORT}`)
  );
}

export function isAllowedOrigin(origin, extensionId) {
  return typeof origin === "string" && extensionId.length > 0 && origin === `chrome-extension://${extensionId}`;
}

export function validateProxyPayload(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "invalid-payload" };
  }
  if ("slots" in value || "bytes" in value || "value" in value) {
    return { ok: false, reason: "forbidden-field" };
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > PROXY_MAX_BODY_BYTES) {
    return { ok: false, reason: "request-too-large" };
  }
  if (typeof value.utterance !== "string" || value.utterance.length > 500) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (value.page === null || typeof value.page !== "object" || Array.isArray(value.page)) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (!Array.isArray(value.segments) || value.segments.length > 24) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (!Array.isArray(value.controls) || value.controls.length > 40) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (
    value.segments.some(
      (item) =>
        item === null ||
        typeof item !== "object" ||
        typeof item.segmentId !== "string" ||
        typeof item.text !== "string" ||
        item.text.length > 6000,
    )
  ) {
    return { ok: false, reason: "invalid-payload" };
  }
  if (
    value.controls.some(
      (item) =>
        item === null ||
        typeof item !== "object" ||
        typeof item.controlId !== "string" ||
        typeof item.label !== "string" ||
        item.label.length > 160,
    )
  ) {
    return { ok: false, reason: "invalid-payload" };
  }
  return { ok: true };
}

export function classifyProxyError(error) {
  const message = error instanceof Error ? error.message : "";
  if (message === "request-too-large") {
    return "request-too-large";
  }
  if (message === "invalid-payload" || message === "forbidden-field") {
    return "invalid-payload";
  }
  if (message.startsWith("provider-http-")) {
    return "upstream-error";
  }
  if (message === "provider-empty" || message === "provider-invalid-json") {
    return "invalid-model-output";
  }
  return "upstream-error";
}

export function corsHeaders(origin, allowPrivateNetwork) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
    ...(allowPrivateNetwork ? { "Access-Control-Allow-Private-Network": "true" } : {}),
  };
}