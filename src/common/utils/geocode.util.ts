interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Geocodes an address to lat/lng using OpenStreetMap Nominatim (free, no API key).
 * Returns null if geocoding fails — caller should handle gracefully.
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  country = 'India',
): Promise<GeoPoint | null> {
  try {
    const query = encodeURIComponent(`${address}, ${city}, ${state}, ${country}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PawGo-App/1.0 (contact@pawgo.com)',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
