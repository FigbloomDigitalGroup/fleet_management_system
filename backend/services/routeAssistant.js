import { askJson, isAiConfigured } from "./aiService.js";
import { getDrivingRoute } from "./googleMapsService.js";

const ROUTE_INTENT_PATTERN = /\b(draw|plan|create|make|set up)\b.*\broute\b/i;
const FROM_TO_PATTERN = /from\s+(.+?)\s+to\s+(.+)/i;

// Cheap, non-LLM check — lets the caller skip the route-drawing path
// entirely for ordinary fleet questions.
export function looksLikeRouteRequest(question) {
  return ROUTE_INTENT_PATTERN.test(question);
}

// The model is only ever asked to pull out place NAMES already present in
// the user's own sentence — never to recall or invent coordinates, which is
// exactly the kind of thing language models hallucinate. Real geography is
// resolved afterward by Google's Directions API, not the model.
async function extractOriginDestination(question) {
  const match = question.match(FROM_TO_PATTERN);
  if (match) {
    return { origin: match[1].trim(), destination: match[2].trim() };
  }

  if (!isAiConfigured()) return null;

  const prompt = `Extract the starting place and destination place from this route request. Respond with ONLY JSON in the form {"origin": "...", "destination": "..."} and nothing else — no explanation, no markdown fence. If you can't find a clear origin AND destination, respond with {"origin": null, "destination": null}.

Request: "${question}"`;

  try {
    const result = await askJson(prompt);
    if (!result?.origin || !result?.destination) return null;
    return { origin: String(result.origin), destination: String(result.destination) };
  } catch {
    return null;
  }
}

// Returns null if this doesn't look like a route-drawing request (caller
// falls through to the normal fleet-question path). Otherwise returns either
// a routeDraft (ready to review on the Routes page) or a plain explanatory
// answer if the request couldn't be understood or resolved.
export async function tryHandleRouteRequest(question) {
  if (!looksLikeRouteRequest(question)) return null;

  const parsed = await extractOriginDestination(question);
  if (!parsed) {
    return {
      answer:
        'I can draw a route if you tell me the starting point and destination — try something like "draw a route from X to Y".',
    };
  }

  const result = await getDrivingRoute(parsed.origin, parsed.destination);
  if (result.error) {
    return { answer: `I couldn't draw that route — ${result.error}` };
  }

  return {
    answer: `I've drawn a route from ${result.originAddress} to ${result.destinationAddress} (${result.distanceText}). Open it on the Routes page to pick a vehicle and save it.`,
    routeDraft: {
      name: `${parsed.origin} to ${parsed.destination}`,
      waypoints: result.waypoints,
      originAddress: result.originAddress,
      destinationAddress: result.destinationAddress,
    },
  };
}
