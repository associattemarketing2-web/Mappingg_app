// Small geometry helpers for the map (same maths as the website's live map).

export type LatLng = { lat: number; lng: number };
/** [west, south, east, north] */
export type Bounds = [number, number, number, number];

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Ray-casting point-in-polygon. Polygon points are [lat, lng] like the stored boundaries. */
export function isInsidePolygon(lat: number, lng: number, polygon: readonly (readonly number[])[] | null | undefined): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]?.[0] ?? 0;
    const yi = polygon[i]?.[1] ?? 0;
    const xj = polygon[j]?.[0] ?? 0;
    const yj = polygon[j]?.[1] ?? 0;
    const intersects = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Bounds around points, or null if there are none. */
export function boundsOf(points: readonly LatLng[]): Bounds | null {
  if (!points.length) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  // A single point would give a zero-size box; pad it slightly.
  if (w === e && s === n) return [w - 0.005, s - 0.005, e + 0.005, n + 0.005];
  return [w, s, e, n];
}
