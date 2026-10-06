// Busca de endereço (geocodificação) pelo Nominatim, do OpenStreetMap: gratuito, uso leve, uma busca por vez.
// Quando houver volume, trocar por um serviço pago (Mapbox, Google) mantendo esta mesma função.
export type Lugar = { nome: string; lat: number; lng: number };

let ultima = 0;
export async function buscarEndereco(texto: string, perto?: { lat: number; lng: number }): Promise<Lugar[]> {
  const q = texto.trim();
  if (q.length < 3) return [];
  const espera = 1100 - (Date.now() - ultima); // regra de uso: no máximo uma busca por segundo
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const p = new URLSearchParams({ format: 'jsonv2', q, limit: '5', countrycodes: 'br', 'accept-language': 'pt-BR', addressdetails: '0' });
  if (perto) { const d = 0.6; p.set('viewbox', `${perto.lng - d},${perto.lat + d},${perto.lng + d},${perto.lat - d}`); }
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Busca de endereço indisponível agora.');
  const dados = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return dados.map((x) => ({ nome: x.display_name.split(', ').slice(0, 4).join(', '), lat: Number(x.lat), lng: Number(x.lon) }));
}
