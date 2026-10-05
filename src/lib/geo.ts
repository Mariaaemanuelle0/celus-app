export type Ponto = { lat: number; lng: number };

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatarDistancia(km: number): string {
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

export function centroPiloto(): Ponto {
  const env = import.meta.env.VITE_PILOT_CENTER as string | undefined;
  if (env) {
    const [lat, lng] = env.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return { lat: -23.5505, lng: -46.6333 }; // São Paulo, centro
}
