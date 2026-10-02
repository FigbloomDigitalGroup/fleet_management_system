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
