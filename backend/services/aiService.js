// The language model behind the AI features (anomaly scans, the fleet chat
// assistant, and the route/geofence helpers): OpenAI's Chat Completions API
// with OPENAI_API_KEY. Kept behind these three functions so the features
// don't depend on which provider is used.
//
// The main model answers in a few seconds; when OpenAI reports it busy
// (429/5xx) or it doesn't answer in time, the request is retried once on
// the faster fallback model. Both can be changed from the env.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const AI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4.1-mini";
const TIMEOUT_MS = 30000;

const isTransient = (status) => status === 429 || status >= 500;

// Whether the AI features can run at all — lets a scan or chat fail fast and
// clearly when no key is configured, instead of erroring per request.
export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function callModel(model, prompt, json) {
  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const error = new Error(`Could not reach OpenAI: ${err.message}`);
    error.transient = true;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`OpenAI responded with status ${response.status}${data.error?.message ? `: ${data.error.message}` : ""}`);
    error.transient = isTransient(response.status);
    throw error;
  }
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function generate(prompt, { json = false } = {}) {
  if (!isAiConfigured()) throw new Error("OPENAI_API_KEY is not set");
  try {
    return await callModel(AI_MODEL, prompt, json);
  } catch (err) {
    if (!err.transient || AI_FALLBACK_MODEL === AI_MODEL) throw err;
    return callModel(AI_FALLBACK_MODEL, prompt, json);
  }
}

// Sends a prompt and returns the model's plain-text answer.
export function generateText(prompt) {
  return generate(prompt);
}

// Same, but in JSON mode, parsed. (JSON mode needs the word "JSON" in the
// prompt — every caller's prompt asks for JSON.) Throws if the output still
// isn't valid JSON (a stray ```json fence is stripped first).
export async function askJson(prompt) {
  const raw = await generate(prompt, { json: true });
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`The AI returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}
