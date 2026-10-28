import { askJson, isAiConfigured } from "./aiService.js";
import { getPlaceLocation } from "./googleMapsService.js";

const GEOFENCE_INTENT_PATTERN = /\b(draw|plan|create|make|set up|add)\b.*\bgeo-?fence\b/i;
const PLACE_PATTERN = /\b(?:around|at|near|for|in)\s+(.+?)(?=\s+with\b|\s*$)/i;
const RADIUS_PATTERN = /(\d+(?:\.\d+)?)\s*(kilometers?|kilometres?|km|meters?|metres?|m)\b/i;
const DEFAULT_RADIUS_METERS = 500;

// Cheap, non-LLM check — lets the caller skip the geofence-drawing path
// entirely for ordinary fleet questions.
export function looksLikeGeofenceRequest(question) {
  return GEOFENCE_INTENT_PATTERN.test(question);
}

function extractRadiusMeters(question) {
  const match = question.match(RADIUS_PATTERN);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  return Math.round(unit.startsWith("k") ? value * 1000 : value);
}

// The model is only ever asked to pull out a place NAME already present in
// the user's own sentence — never to recall or invent coordinates. Real
// geography is resolved afterward by Google's Directions API, not the model.
async function extractPlace(question) {
  const match = question.match(PLACE_PATTERN);
  if (match) return match[1].trim().replace(/[.,!?]+$/, "");

  if (!isAiConfigured()) return null;

  const prompt = `Extract just the place name from this geofence request — ignore any radius or distance mentioned. Respond with ONLY JSON in the form {"place": "..."} and nothing else — no explanation, no markdown fence. If you can't find a clear place, respond with {"place": null}.

Request: "${question}"`;

  try {
    const result = await askJson(prompt);
    if (!result?.place) return null;
    return String(result.place);
  } catch {
    return null;
  }
}

// Returns null if this doesn't look like a geofence-drawing request (caller
// falls through to the normal fleet-question path). Otherwise returns either
// a geofenceDraft (ready to review on the Geofences page) or a plain
// explanatory answer if the request couldn't be understood or resolved.
export async function tryHandleGeofenceRequest(question) {
  if (!looksLikeGeofenceRequest(question)) return null;

  const place = await extractPlace(question);
  if (!place) {
    return {
      answer:
        'I can set up a geofence if you tell me the place — try something like "create a geofence around Westlands" or "add a geofence for the depot with a 300m radius".',
    };
  }

  const result = await getPlaceLocation(place);
  if (result.error) {
    return { answer: `I couldn't set up that geofence — ${result.error}` };
  }

  const radiusMeters = extractRadiusMeters(question) || DEFAULT_RADIUS_METERS;

  return {
    answer: `I've set up a geofence zone around ${result.address} with a ${radiusMeters}m radius. Open it on the Geofences page to review and save it.`,
    geofenceDraft: {
      name: place,
      lat: result.lat,
      lng: result.lng,
      radiusMeters,
    },
  };
}




