import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapaGL, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// O Vite empacota o worker do MapLibre (com as dependências dele) e devolve a URL final.
import urlTrabalhador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(urlTrabalhador);
import { ESTILO_CELUS } from '../lib/estiloMapa';
import type { Ponto } from '../lib/geo';

const ESTILO_EXTERNO = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;

export type Pino = { id: string; lat: number; lng: number; html: string; classe: string; cor: string; z?: number };
export type Celula = { coords: [number, number][]; cor: string; opacidade: number };

type Props = {
  centro: Ponto;
  raioKm: number;
  pinos: Pino[];
  celulas: Celula[];
  mudarPonto: boolean;
  onMover: (p: Ponto) => void;
  onPino: (id: string) => void;
  onFundo: () => void;
};

/** Círculo do raio de busca como polígono (o MapLibre não tem círculo em metros). */
function circulo(c: Ponto, km: number): [number, number][] {
  const pts: [number, number][] = [];
  const dLat = km / 110.574, dLng = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= 72; i++) { const t = (i / 72) * 2 * Math.PI; pts.push([c.lng + dLng * Math.cos(t), c.lat + dLat * Math.sin(t)]); }
  return pts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features }) as any;

/** Mapa vetorial da Celus (MapLibre). Gira e inclina com dois dedos, como nos apps de navegação. */
export function Mapa({ centro, raioKm, pinos, celulas, mudarPonto, onMover, onPino, onFundo }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const marcadores = useRef(new globalThis.Map<string, Marker>());
  const eu = useRef<Marker | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const cbs = useRef({ onMover, onPino, onFundo, mudarPonto });
  cbs.current = { onMover, onPino, onFundo, mudarPonto };

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!caixa.current) return;
    let m: MapaGL;
    try {
      m = new maplibregl.Map({
        container: caixa.current,
        style: ESTILO_EXTERNO || ESTILO_CELUS,
        center: [centro.lng, centro.lat],
        zoom: 13.7,
        pitch: 35,
        maxPitch: 60,
        attributionControl: { compact: true },
      });
    } catch {
      setFalhou(true);
      return;
    }
    mapa.current = m;
    // Espaço da busca no topo e da folha de lugares embaixo: o centro fica na área visível.
    m.setPadding({ top: 110, bottom: 100, left: 0, right: 0 });
    m.once('style.load', () => {
      m.addSource('raio', { type: 'geojson', data: fc([]) });
      m.addLayer({ id: 'raio-fill', type: 'fill', source: 'raio', paint: { 'fill-color': '#4C8DFF', 'fill-opacity': 0.07 } });
      m.addLayer({ id: 'raio-linha', type: 'line', source: 'raio', paint: { 'line-color': '#4C8DFF', 'line-opacity': 0.75, 'line-width': 1.4, 'line-dasharray': [1, 3] } });
      m.addSource('sema', { type: 'geojson', data: fc([]) });
      m.addLayer({ id: 'sema-fill', type: 'fill', source: 'sema', paint: { 'fill-color': ['get', 'cor'], 'fill-opacity': ['get', 'op'] } }, 'raio-fill');
      setPronto(true);
    });
    m.on('click', (e) => {
      if (cbs.current.mudarPonto) cbs.current.onMover({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      else cbs.current.onFundo();
    });
    const el = document.createElement('div'); el.className = 'me';
    eu.current = new maplibregl.Marker({ element: el }).setLngLat([centro.lng, centro.lat]).addTo(m);
    const lista = marcadores.current;
    return () => { lista.clear(); m.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Segue o ponto de busca.
  useEffect(() => {
    const m = mapa.current; if (!m) return;
    m.easeTo({ center: [centro.lng, centro.lat], duration: 600 });
    eu.current?.setLngLat([centro.lng, centro.lat]);
  }, [centro.lat, centro.lng]);

  // Raio de busca.
  useEffect(() => {
    if (!pronto || !mapa.current) return;
    (mapa.current.getSource('raio') as GeoJSONSource).setData(fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circulo(centro, raioKm)] } }]));
  }, [pronto, centro, raioKm]);

  // Células do semáforo.
  useEffect(() => {
    if (!pronto || !mapa.current) return;
    (mapa.current.getSource('sema') as GeoJSONSource).setData(fc(celulas.map((c) => ({ type: 'Feature', properties: { cor: c.cor, op: c.opacidade }, geometry: { type: 'Polygon', coordinates: [c.coords] } }))));
  }, [pronto, celulas]);

  // Pinos: cria, atualiza e remove sem recriar o mapa.
  useEffect(() => {
    const m = mapa.current; if (!m) return;
    const atuais = marcadores.current;
    const ids = new Set(pinos.map((p) => p.id));
    for (const [id, mk] of atuais) if (!ids.has(id)) { mk.remove(); atuais.delete(id); }
    for (const p of pinos) {
      let mk: Marker | undefined = atuais.get(p.id);
      if (!mk) {
        const el = document.createElement('button');
        el.type = 'button';
        el.addEventListener('click', (ev) => { ev.stopPropagation(); cbs.current.onPino(p.id); });
        const novo = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(m);
        atuais.set(p.id, novo);
        mk = novo;
      }
      const el = mk.getElement();
      el.className = 'pin-alvo';
      el.style.zIndex = String(p.z ?? 1);
      const html = `<span class="pin ${p.classe}" style="--c:${p.cor}">${p.html}</span>`;
      if (el.innerHTML !== html) el.innerHTML = html;
      el.setAttribute('aria-label', el.textContent ?? 'Lugar');
      mk.setLngLat([p.lng, p.lat]);
    }
  }, [pinos]);

  useEffect(() => { if (mapa.current) mapa.current.getCanvas().style.cursor = mudarPonto ? 'crosshair' : ''; }, [mudarPonto]);

  return (
    <div className="mapa-gl">
      <div ref={caixa} className="mapa-gl-in" />
      {falhou && <div className="mapa-falha">Seu navegador não conseguiu abrir o mapa. Use a lista abaixo.</div>}
    </div>
  );
}
