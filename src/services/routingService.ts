
type Coordinate = [number, number];

interface ORSResponse {
  features?: {
    properties?: {
      summary?: {
        distance: number;
        duration: number;
      };
    };
    geometry?: {
      coordinates: Coordinate[];
    };
  }[];
}

export const calculateRoute = async (
  coordinates: Coordinate[]
) => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "API Key OpenRouteService belum dikonfigurasi."
    );
  }

  if (coordinates.length < 2) {
    throw new Error(
      "Minimal harus ada dua titik untuk menghitung rute."
    );
  }

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates,
        instructions: false,
      }),
    }
  );

  const result = await response.json() as ORSResponse;

  if (!response.ok) {
    console.error("ORS ERROR:", result);

    throw new Error(
      "Gagal menghitung jalur menggunakan OpenRouteService."
    );
  }

  const feature = result.features?.[0];
  const summary = feature?.properties?.summary;
  const routeCoordinates = feature?.geometry?.coordinates;

  if (!summary || !routeCoordinates) {
    throw new Error("Data jalur dari OpenRouteService tidak valid.");
  }

  return {
    distance: summary.distance,
    duration: summary.duration,
    coordinates: routeCoordinates,
  };
};
