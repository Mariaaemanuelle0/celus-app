import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORIAS, ORDEM_CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Anuncio, Categoria } from '../data/types';
import { useAnuncios } from '../data/useAnuncios';
import { centroPiloto, distanciaKm, formatarDistancia, type Ponto } from '../lib/geo';
import { nota, rotuloPreco, virgula } from '../lib/format';

const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = (import.meta.env.VITE_MAP_ATTRIBUTION as string) || '&copy; OpenStreetMap';

const nomeSub = (a: Anuncio) =>
  a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] ?? '' : CATEGORIAS[a.categoria].subs[a.subcategoria] ?? '';

function iconePin(a: Anuncio, longe: boolean) {
  const cor = CATEGORIAS[a.categoria].cor;
  return L.divIcon({
    className: '',
    html: `<div class="pin ${longe ? 'far' : ''}" style="--c:${cor}"><b></b><span>${rotuloPreco(a, true)}</span></div>`,
    iconSize: [0, 0],
  });
}
const iconeEu = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

function SeguirCentro({ centro }: { centro: Ponto }) {
  const map = useMap();
  useEffect(() => { map.setView([centro.lat, centro.lng]); }, [centro, map]);
  return null;
}

/** Toque no mapa muda o ponto de busca quando o modo "mudar ponto" está ligado. */
function CliqueParaMover({ ativo, onMover }: { ativo: boolean; onMover: (p: Ponto) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!ativo) return;
    const h = (e: L.LeafletMouseEvent) => onMover({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on('click', h);
    map.getContainer().style.cursor = 'crosshair';
    return () => { map.off('click', h); map.getContainer().style.cursor = ''; };
  }, [ativo, map, onMover]);
  return null;
}

export function MapPage() {
  const { anuncios, ficticio, carregando, erro } = useAnuncios();
  const [centro, setCentro] = useState<Ponto>(centroPiloto());
  const [usandoGps, setUsandoGps] = useState(false);
  const [raio, setRaio] = useState(1.5);
  const [cat, setCat] = useState<Categoria | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [mudarPonto, setMudarPonto] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => { setCentro({ lat: p.coords.latitude, lng: p.coords.longitude }); setUsandoGps(true); },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const lista = useMemo(() => anuncios
    .filter((a) => !cat || a.categoria === cat)
    .filter((a) => !sub || a.subcategoria === sub)
    .map((a) => ({ a, d: distanciaKm(centro, a) }))
    .sort((x, y) => x.d - y.d), [anuncios, cat, sub, centro]);
  const noRaio = lista.filter((x) => x.d <= raio);

  const escolher = (k: Categoria) => { setCat(cat === k ? null : k); setSub(null); };

  return (
    <>
      <h1>Do que você precisa agora?</h1>
      {ficticio && <div className="notice">Dados fictícios de teste. Os anúncios reais entram quando o banco de dados estiver ligado.</div>}

      <div className="cats">
        {ORDEM_CATEGORIAS.map((k) => (
          <button key={k} className="cat" style={{ ['--c' as string]: CATEGORIAS[k].cor }} aria-pressed={cat === k} onClick={() => escolher(k)}>
            <i />{CATEGORIAS[k].curto ?? CATEGORIAS[k].nome}
          </button>
        ))}
      </div>

      {cat && (
        <div className="chips" style={{ marginTop: 12 }}>
          {Object.entries(CATEGORIAS[cat].subs).map(([k, n]) => (
            <button key={k} className="chip" aria-pressed={sub === k} onClick={() => setSub(sub === k ? null : k)}>{n}</button>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <span className="meta">Raio: <span className="num">{formatarDistancia(raio)}</span></span>
        <span className="sp" />
        <button className={`btn sm ${mudarPonto ? '' : 'ghost'}`} onClick={() => setMudarPonto(!mudarPonto)}>
          {mudarPonto ? 'Toque no mapa' : 'Mudar ponto de busca'}
        </button>
      </div>
      <input type="range" min={0.3} max={5} step={0.1} value={raio} onChange={(e) => setRaio(Number(e.target.value))} aria-label="Raio de busca" />

      <div className="mapbox">
        <MapContainer center={[centro.lat, centro.lng]} zoom={14} zoomControl={false} attributionControl>
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
          <SeguirCentro centro={centro} />
          <CliqueParaMover ativo={mudarPonto} onMover={(p) => { setCentro(p); setMudarPonto(false); }} />
          <Circle center={[centro.lat, centro.lng]} radius={raio * 1000} pathOptions={{ color: '#4C8DFF', weight: 1.5, fillColor: '#4C8DFF', fillOpacity: 0.1 }} />
          <Marker position={[centro.lat, centro.lng]} icon={iconeEu} />
          {lista.map(({ a, d }) => (
            <Marker key={a.id} position={[a.lat, a.lng]} icon={iconePin(a, d > raio)}
              eventHandlers={{ click: () => { document.getElementById(`a-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} />
          ))}
        </MapContainer>
        <div className="mapcount"><span className="coin">{noRaio.length} no raio</span></div>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>{usandoGps ? 'Usando sua localização.' : 'Sem acesso à sua localização: mostrando o centro da cidade piloto.'}</p>

      <h2>{noRaio.length} {noRaio.length === 1 ? 'lugar' : 'lugares'} até {formatarDistancia(raio)}</h2>
      {carregando && <p className="meta">Carregando…</p>}
      {erro && <p className="meta">Não foi possível carregar os anúncios: {erro}</p>}
      <div className="stack">
        {noRaio.map(({ a, d }) => (
          <Link key={a.id} id={`a-${a.id}`} to={`/anuncio/${a.id}`} className="box listrow">
            <span className="thumb" style={{ ['--c' as string]: CATEGORIAS[a.categoria].cor }} />
            <div>
              <span className="t">{a.titulo}</span>
              <span className="meta">{formatarDistancia(d)} · {nomeSub(a)}{a.metragemM2 ? ` · ${a.metragemM2} m²` : ''} · <span className="num">★ {virgula(nota(a))}</span></span>
              <span className="coin">{rotuloPreco(a)}</span>
            </div>
          </Link>
        ))}
        {!carregando && !noRaio.length && <div className="empty">Nada nesse raio. Aumente o raio ou escolha outra categoria.</div>}
      </div>
    </>
  );
}
