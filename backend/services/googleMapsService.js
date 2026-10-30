const GOOGLE_MAPS_SERVER_API_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY;

// Decodes Google's encoded polyline format into an array of {lat, lng}
// points. https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Short local place names ("Ole Sereni", "KCA University") are too
// ambiguous for Directions to resolve on their own — bias them toward this
// platform's primary market (every map in the app already defaults its
// center to Nairobi) unless the query already names a city/country itself.
function withRegionalContext(query) {
  if (/kenya|nairobi/i.test(query)) return query;
  return `${query}, Nairobi, Kenya`;
}

// Gets the actual driving path between two free-text places (Directions API
// does its own geocoding internally, so there's no separate geocode call
// needed, and no risk of the two ends resolving to mismatched coordinates).
export async function getDrivingRoute(originQuery, destinationQuery) {
  if (!GOOGLE_MAPS_SERVER_API_KEY) {
    return { error: "Route drawing isn't configured yet — GOOGLE_MAPS_SERVER_API_KEY is missing on the server." };
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    withRegionalContext(originQuery)
  )}&destination=${encodeURIComponent(withRegionalContext(destinationQuery))}&mode=driving&key=${GOOGLE_MAPS_SERVER_API_KEY}`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    return { error: `Could not reach Google Directions: ${err.message}` };
  }

  if (data.status !== "OK" || !data.routes?.length) {
    const reason =
      data.status === "ZERO_RESULTS"
        ? "No driving route found between those two places."
        : data.status === "NOT_FOUND"
        ? "One of those places couldn't be found."
        : `Directions lookup failed (${data.status}).`;
    return { error: reason };
  }

  const route = data.routes[0];
  const leg = route.legs[0];
  return {
    waypoints: decodePolyline(route.overview_polyline.points),
    originAddress: leg?.start_address,
    destinationAddress: leg?.end_address,
    distanceText: leg?.distance?.text,
  };
}

// Resolves a single free-text place to a lat/lng — there's no separate
// Geocoding API call here (this key only has Directions enabled; a direct
// Geocoding request returns REQUEST_DENIED). Directions does its own
// geocoding internally even for a zero-length "route" from a place to
// itself, so requesting origin === destination is a reliable way to recover
// just one resolved coordinate without needing a second API.
export async function getPlaceLocation(query) {
  if (!GOOGLE_MAPS_SERVER_API_KEY) {
    return { error: "Geofence drawing isn't configured yet — GOOGLE_MAPS_SERVER_API_KEY is missing on the server." };
  }

  const place = withRegionalContext(query);
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    place
  )}&destination=${encodeURIComponent(place)}&mode=driving&key=${GOOGLE_MAPS_SERVER_API_KEY}`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    return { error: `Could not reach Google Directions: ${err.message}` };
  }

  if (data.status !== "OK" || !data.routes?.length) {
    const reason = data.status === "NOT_FOUND" ? "That place couldn't be found." : `Location lookup failed (${data.status}).`;
    return { error: reason };
  }

  const leg = data.routes[0].legs[0];
  return { lat: leg.start_location.lat, lng: leg.start_location.lng, address: leg.start_address };
}

// The driving line through stops in the given order ([{ lat, lng }]), with
// its length and drive time. Directions takes at most 25 stops between the
// two ends, so longer runs are fetched in pieces that share their end stop.
export async function getDrivingPathThrough(stops) {
  if (!GOOGLE_MAPS_SERVER_API_KEY) return { error: "GOOGLE_MAPS_SERVER_API_KEY is missing on the server." };
  if (stops.length < 2) return { error: "Too few stops to route." };

  const MAX_STOPS = 27;
  const path = [];
  let meters = 0;
  let seconds = 0;
  const at = (p) => `${p.lat},${p.lng}`;
  for (let start = 0; start < stops.length - 1; start += MAX_STOPS - 1) {
    const chunk = stops.slice(start, start + MAX_STOPS);
    const middle = chunk.slice(1, -1).map(at).join("|");
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${at(chunk[0])}` +
      `&destination=${at(chunk[chunk.length - 1])}` +
      (middle ? `&waypoints=${encodeURIComponent(middle)}` : "") +
      `&mode=driving&key=${GOOGLE_MAPS_SERVER_API_KEY}`;

    let data;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (err) {
      return { error: `Could not reach Google Directions: ${err.message}` };
    }
    if (data.status !== "OK" || !data.routes?.length) return { error: `Directions lookup failed (${data.status}).` };

    const route = data.routes[0];
    for (const leg of route.legs) {
      meters += leg.distance?.value || 0;
      seconds += leg.duration?.value || 0;
    }
    // Each step's own polyline keeps the line on the road at street level
    // (the overview polyline is simplified).
    for (const step of route.legs.flatMap((leg) => leg.steps)) {
      for (const point of decodePolyline(step.polyline.points)) {
        const last = path[path.length - 1];
        if (!last || last.lat !== point.lat || last.lng !== point.lng) path.push(point);
      }
    }
  }
  return { path, distanceKm: meters / 1000, durationMin: seconds / 60 };
}
