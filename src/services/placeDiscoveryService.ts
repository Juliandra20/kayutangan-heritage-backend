
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

export const fetchKayutanganPlaces = async (): Promise<DiscoveredPlace[]> => {
  const query = `
    [out:json][timeout:60];
    (
      nwr(-7.984,112.625,-7.972,112.635)["name"]["tourism"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["historic"];
      nwr(-7.984,112.625,-7.972,112.635)["name"]["amenity"="place_of_worship"];
    );
    out center tags;
  `;

  const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "KayutanganHeritage/1.0",
      },
      body: new URLSearchParams({ data: query }),
    }
  );

  if (!response.ok) {
  const errorText = await response.text();

  console.error("OVERPASS STATUS:", response.status);
  console.error("OVERPASS RESPONSE:", errorText);

  throw new Error(
    `OpenStreetMap gagal. Status: ${response.status}. ${errorText}`
  );
}

  const result = (await response.json()) as OverpassResponse;

  const places = result.elements
    .map((element) => {
      const tags = element.tags || {};

      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;

      if (
        !tags.name ||
        latitude === undefined ||
        longitude === undefined
      ) {
        return null;
      }

      const category =
        tags.tourism ||
        tags.historic ||
        tags.amenity ||
        "Tempat wisata";

      const address =
        tags["addr:street"] || null;

      return {
        osmId: `${element.type}-${element.id}`,
        name: tags.name,
        category,
        latitude,
        longitude,
        address,
      };
    })
    .filter((place): place is DiscoveredPlace => place !== null);

  return places;
};
