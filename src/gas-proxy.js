/**
 * ============================================================
 * GAS Proxy v2 — Upgraded bridge to Google Apps Script
 * ============================================================
 * Two calling modes:
 *   1. gasDirectAction(action, params) — structured payload, skips
 *      Gemini classification. Use for all tools that have a known
 *      GAS action handler (detail_card, dashboard, etc.)
 *   2. gasVoiceQuery(text, context) — natural language through
 *      Gemini classifier. Fallback for tools that need NLU.
 *
 * Both share retry logic with exponential backoff for Cloud Run
 * cold starts and GAS quota transients.
 *
 * Session 143 — 2026-10-02 — Full MCP upgrade
 * ============================================================
 */

// GAS web app URL — MUST be set via environment variable
const GAS_URL = process.env.GAS_URL;
if (!GAS_URL) {
  console.error("[EZeeTC MCP] FATAL: GAS_URL environment variable is required");
  process.exit(1);
}

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;  // Base delay, doubles each retry
const DEFAULT_TIMEOUT_MS = 60000;
const QUICK_TIMEOUT_MS = 15000; // For lightweight lookups

/**
 * Parse a GAS response, handling double-encoding and string wrapping.
 * @param {string} text - Raw response text
 * @returns {Object} Parsed response object
 */
function parseGasResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(JSON.parse(`"${text}"`));
    } catch {
      return { response: text, action: "RAW_TEXT" };
    }
  }
  // GAS sometimes returns a JSON string inside JSON
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { response: parsed, action: "RAW_TEXT" };
    }
  }
  return parsed;
}

/**
 * Core fetch with retry logic and timeout.
 * Retries on: network errors, 429, 500, 502, 503, 504.
 * Does NOT retry on 400, 401, 403, 404 (client errors).
 *
 * @param {Object} body - Request payload
 * @param {number} timeoutMs - Request timeout
 * @returns {Promise<Object>} Parsed response
 */
async function fetchWithRetry(body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startMs = Date.now();
      console.log(`[GAS Proxy] → ${body.action || "voice"}${attempt > 0 ? ` (retry ${attempt})` : ""}: ${JSON.stringify(body).substring(0, 200)}`);

      const response = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(body),
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const elapsedMs = Date.now() - startMs;

      // Client errors — don't retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errText = await response.text().catch(() => "");
        throw new Error(`GAS returned HTTP ${response.status}: ${errText || response.statusText}`);
      }

      // Server errors — retry
      if (!response.ok) {
        throw new Error(`GAS returned HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const parsed = parseGasResponse(text);

      console.log(`[GAS Proxy] ← ${parsed.action || "unknown"} (${elapsedMs}ms): ${(parsed.response || "").substring(0, 150)}`);
      return parsed;

    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === "AbortError") {
        lastError = new Error(`GAS request timed out after ${timeoutMs}ms`);
      }

      // Don't retry on client errors (re-thrown above without retry flag)
      if (err.message.includes("HTTP 4") && !err.message.includes("HTTP 429")) {
        throw err;
      }

      // Retry with backoff
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`[GAS Proxy] ⚠️ Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Send a direct structured action to GAS, bypassing Gemini classification.
 * Use this for tools with known GAS action handlers.
 *
 * @param {string} action - The GAS action name (e.g., "detail_card", "dashboard")
 * @param {Object} params - Action-specific parameters
 * @param {Object} [options] - { timeout, source }
 * @returns {Promise<Object>} Parsed response
 */
export async function gasDirectAction(action, params = {}, options = {}) {
  const body = {
    source: options.source || "mcp_direct",
    action,
    ...params,
  };
  return fetchWithRetry(body, options.timeout || DEFAULT_TIMEOUT_MS);
}

/**
 * Send a voice text query through EZee's Gemini classification pipeline.
 * Fallback for tools that need natural language understanding.
 *
 * @param {string} text - Natural language query
 * @param {Object} [context={}] - Session context (pendingDraft, etc.)
 * @param {Object} [options] - { timeout }
 * @returns {Promise<Object>} Parsed response
 */
export async function gasVoiceQuery(text, context = {}, options = {}) {
  const body = {
    source: "ezee_voice",
    action: "voice",
    text,
    context: typeof context === "string" ? context : JSON.stringify(context),
  };
  return fetchWithRetry(body, options.timeout || DEFAULT_TIMEOUT_MS);
}

/**
 * Legacy single-function proxy — kept for backward compatibility.
 * New tools should use gasDirectAction or gasVoiceQuery instead.
 */
export async function gasProxy(payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const body = {
    source: "ezee_voice",
    ...payload,
  };
  return fetchWithRetry(body, timeoutMs);
}

// Export timeout constants for tool modules
export { DEFAULT_TIMEOUT_MS, QUICK_TIMEOUT_MS };
