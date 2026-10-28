// Google Gemini — the model behind the AI features (anomaly scans, the
// fleet chat assistant, and the route/geofence helpers). Called over its
// REST API with GEMINI_API_KEY (from https://aistudio.google.com/apikey).
//
// The main model answers in a couple of seconds; when Google reports it
// overloaded (429/5xx) or it doesn't answer in time, the request is retried
// once on the lighter fallback model. Both can be changed from the env when
// Google retires a version.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const TIMEOUT_MS = 20000;

const modelUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const isTransient = (status) => status === 429 || status >= 500;

// Whether the AI features can run at all — lets a scan or chat fail fast and
// clearly when no key is configured, instead of erroring per request.
export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function callModel(model, prompt, json) {
  let response;
  try {
    response = await fetch(modelUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const error = new Error(`Could not reach Gemini: ${err.message}`);
    error.transient = true;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Gemini responded with status ${response.status}${data.error?.message ? `: ${data.error.message}` : ""}`);
    error.transient = isTransient(response.status);
    throw error;
  }
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

async function generate(prompt, { json = false } = {}) {
  if (!isAiConfigured()) throw new Error("GEMINI_API_KEY is not set");
  try {
    return await callModel(GEMINI_MODEL, prompt, json);
  } catch (err) {
    if (!err.transient || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw err;
    return callModel(GEMINI_FALLBACK_MODEL, prompt, json);
  }
}

// Sends a prompt and returns the model's plain-text answer.
export function generateText(prompt) {
  return generate(prompt);
}

// Same, but in Gemini's JSON mode, parsed. Throws if the output still isn't
// valid JSON (a stray ```json fence is stripped first).
export async function askJson(prompt) {
  const raw = await generate(prompt, { json: true });
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}
