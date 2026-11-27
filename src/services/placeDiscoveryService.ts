interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface DiscoveredPlace {
  osmId: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

// Cache hasil discovery selama backend berjalan
let cachedPlaces: DiscoveredPlace[] | null = null;
let cacheTime = 0;

const CACHE_DURATION = 10 * 60 * 1000; // 10 menit

export const fetchKayutanganPlaces = async (): Promise<
  DiscoveredPlace[]
> => {
  const now = Date.now();

  if (
    cachedPlaces !== null &&
    now - cacheTime < CACHE_DURATION
  ) {
    return cachedPlaces;
  }

  const query = `
    [out:json][timeout:60];
    (
      nwr(-7.984,112.625,-7.972,112.635)["name"]["tourism"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["historic"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["amenity"="place_of_worship"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["amenity"="restaurant"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["amenity"="cafe"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["amenity"="fast_food"];
    );
    out center tags;
  `;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  const errors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          "User-Agent": "KayutanganHeritage/1.0",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90000),
      });

      if (!response.ok) {
        errors.push(`${endpoint} - HTTP ${response.status}`);
        continue;
      }

      const result =
        (await response.json()) as OverpassResponse;

      if (!Array.isArray(result.elements)) {
        throw new Error("Format respons Overpass tidak valid.");
      }

      const places = result.elements
        .map((element): DiscoveredPlace | null => {
          const tags = element.tags ?? {};

          const latitude =
            element.lat ?? element.center?.lat;

          const longitude =
            element.lon ?? element.center?.lon;

          if (
            !tags.name ||
            latitude === undefined ||
            longitude === undefined
          ) {
            return null;
          }

          const category =
            tags.amenity ||
            tags.tourism ||
            tags.historic ||
            "unknown";

          return {
            osmId: `${element.type}-${element.id}`,
            name: tags.name,
            category,
            latitude,
            longitude,
            address: tags["addr:street"] || null,
          };
        })
        .filter(
          (place): place is DiscoveredPlace =>
            place !== null
        );

      cachedPlaces = places;
      cacheTime = Date.now();

      return places;
    } catch (error: unknown) {
      errors.push(`${endpoint} - ${String(error)}`);
    }
  }

  throw new Error(
    `Semua server Overpass gagal diakses: ${errors.join(" | ")}`
  );
};