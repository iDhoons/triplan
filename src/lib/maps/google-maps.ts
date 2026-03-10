import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let initialized = false;
let loadPromise: Promise<typeof google> | null = null;

function initGoogleMapsOptions(): void {
  if (!initialized) {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      v: "weekly",
      libraries: ["maps", "marker"],
    });
    initialized = true;
  }
}

/**
 * Google Maps API를 한 번만 로드하고 이후에는 캐시된 promise를 반환합니다.
 */
export async function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;
  initGoogleMapsOptions();
  loadPromise = importLibrary("maps").then(() => window.google);
  return loadPromise;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}
