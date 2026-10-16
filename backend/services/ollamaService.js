const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

// Cheap connectivity check (no generation) — used to fail a scan run fast and
// clearly when Ollama is offline, instead of retrying a full prompt per vehicle.
export async function isOllamaReachable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// Sends a prompt to the local Ollama model and returns its raw text response.
// Throws on network failure or a non-2xx response.
export async function generateText(prompt) {
  let response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    });
  } catch (err) {
    throw new Error(`Could not reach Ollama at ${OLLAMA_URL}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Ollama responded with status ${response.status}`);
  }

  const data = await response.json();
  return (data.response || "").trim();
}

// Same as generateText, but parses the response as JSON. Throws if the model's
// output isn't valid JSON (occasionally it wraps the answer in a ```json fence
// despite instructions not to — that's stripped before parsing).
export async function askOllama(prompt) {
  const raw = await generateText(prompt);
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Ollama returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}




































