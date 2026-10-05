import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Rectangle, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CATEGORIAS, COMODIDADES, ORDEM_CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Anuncio, Categoria } from '../data/types';
import { useAnuncios } from '../data/useAnuncios';
import { Miniatura, toast, useLocalizacao } from '../components/ui';
import { centroPiloto, distanciaKm, formatarDistancia, type Ponto } from '../lib/geo';
import { nota, precoBase, rotuloPreco, virgula } from '../lib/format';
import { SLOTS, slotDe } from '../lib/regras';
import { COR_CSS, leitura } from '../lib/semaforo';
import { marcarSemaforo } from '../store/acoes';
import { useDB } from '../store/db';

const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = (import.meta.env.VITE_MAP_ATTRIBUTION as string) || '&copy; OpenStreetMap';

const nomeSub = (a: Anuncio) =>
  a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] ?? '' : CATEGORIAS[a.categoria].subs[a.subcategoria] ?? '';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function iconePin(a: Anuncio, longe: boolean) {
  const cor = CATEGORIAS[a.categoria].cor;
  return L.divIcon({ className: '', html: `<div class="pin ${longe ? 'far' : ''}" style="--c:${cor}"><b></b><span>${rotuloPreco(a, true)}</span></div>`, iconSize: [0, 0] });
}
const iconeEu = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

function SeguirCentro({ centro }: { centro: Ponto }) {
  const map = useMap();
  useEffect(() => { map.setView([centro.lat, centro.lng]); }, [centro, map]);
  return null;
}
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

/** Camada que pinta as células do semáforo ao redor do ponto de busca. */
function CamadaSemaforo({ centro }: { centro: Ponto }) {
  const marcas = useDB((d) => d.semaforo);
  const slot = slotDe();
  const dLat = 0.8 / 110.574, dLng = 0.8 / (111.32 * Math.cos((centro.lat * Math.PI) / 180));
  const i0 = Math.floor(centro.lat / dLat), j0 = Math.floor(centro.lng / dLng);
  const cells = [];
  for (let i = i0 - 3; i <= i0 + 3; i++) for (let j = j0 - 3; j <= j0 + 3; j++) {
    const p = { lat: (i + 0.5) * dLat, lng: (j + 0.5) * dLng };
    const l = leitura(p, slot, marcas);
    const cor = { verde: '#3DD68C', amarelo: '#F5B44A', vermelho: '#FF6B6B', sem: '#8E9AB4' }[l.cor];
    cells.push(<Rectangle key={`${i}_${j}`} bounds={[[i * dLat, j * dLng], [(i + 1) * dLat, (j + 1) * dLng]]} pathOptions={{ stroke: false, fillColor: cor, fillOpacity: l.cor === 'sem' ? 0.05 : 0.18 }} interactive={false} />);
  }
  return <>{cells}</>;
}

function Semaforo({ centro, colorir, setColorir }: { centro: Ponto; colorir: boolean; setColorir: (v: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const marcas = useDB((d) => d.semaforo);
  const slot = slotDe();
  const l = leitura(centro, slot, marcas);
  const aceso = { vermelho: 1, amarelo: 2, verde: 3, sem: 0 }[l.cor];
  const OPC: [1 | 2 | 3, string, string, string][] = [[3, 'Verde', 'Tranquilo', 'var(--ok)'], [2, 'Amarelo', 'Atenção', 'var(--warn)'], [1, 'Vermelho', 'Não me sinto seguro', 'var(--bad)']];
  return (
    <>
      <button className="sema" aria-label={`Semáforo de segurança: ${l.rotulo}`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {[1, 2, 3].map((n) => <i key={n} className={aceso === n ? 'on' : ''} style={{ ['--c' as string]: ['', 'var(--bad)', 'var(--warn)', 'var(--ok)'][n] }} />)}
      </button>
      {aberto && (
        <div className="semapop">
          <div className="row" style={{ flexWrap: 'nowrap' }}><b className="sp" style={{ fontSize: 13 }}>Aqui, {SLOTS[slot].toLowerCase()}</b><button className="x" onClick={() => setAberto(false)} aria-label="Fechar">×</button></div>
          <div style={{ fontSize: 13, margin: '2px 0 10px' }}><b style={{ color: l.cor === 'sem' ? 'var(--muted)' : COR_CSS[l.cor] }}>{l.rotulo}</b> <span className="hint num">· {l.n} marcações</span></div>
          <div className="hint" style={{ marginBottom: 6 }}>Como está para você agora?</div>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            {OPC.map(([n, nome, desc, cor]) => (
              <button key={n} className="semaopt" style={{ ['--c' as string]: cor }} aria-label={`${nome}: ${desc}`} onClick={() => { const g = marcarSemaforo(centro, n); toast(g ? `Semáforo marcado · +${g} celus` : 'Semáforo marcado'); }}><i />{nome}</button>
            ))}
          </div>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={colorir} onChange={(e) => setColorir(e.target.checked)} /><span>Colorir o mapa</span></label>
          <p className="hint" style={{ marginTop: 6 }}>Percepção de quem passou por aqui, não garantia.</p>
        </div>
      )}
    </>
  );
}

export function MapPage() {
  const { anuncios } = useAnuncios();
  const gps = useLocalizacao();
  const [centro, setCentro] = useState<Ponto>(centroPiloto());
  const [seguindoGps, setSeguindoGps] = useState(true);
  const [raio, setRaio] = useState(1.5);
  const [cat, setCat] = useState<Categoria | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [prof, setProf] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState(false);
  const [comod, setComod] = useState<string[]>([]);
  const [precoMax, setPrecoMax] = useState(0);
  const [notaMin, setNotaMin] = useState(0);
  const [mudarPonto, setMudarPonto] = useState(false);
  const [colorir, setColorir] = useState(false);

  useEffect(() => { if (gps && seguindoGps) setCentro(gps); }, [gps, seguindoGps]);

  const termo = semAcento(busca.trim());
  const lista = useMemo(() => anuncios
    .filter((a) => !cat || a.categoria === cat)
    .filter((a) => !sub || a.subcategoria === sub)
    .filter((a) => !prof || a.profissao === prof)
    .filter((a) => comod.every((c) => a.comodidades.includes(c)))
    .filter((a) => !precoMax || a.categoria === 'imoveis' || precoBase(a) <= precoMax)
    .filter((a) => nota(a) >= notaMin)
    .filter((a) => !termo || semAcento(`${a.titulo} ${a.descricao} ${a.bairro} ${nomeSub(a)} ${CATEGORIAS[a.categoria].nome}`).includes(termo))
    .map((a) => ({ a, d: distanciaKm(centro, a) }))
    .sort((x, y) => x.d - y.d), [anuncios, cat, sub, prof, comod, precoMax, notaMin, termo, centro]);
  const noRaio = lista.filter((x) => x.d <= raio);
  const nFiltros = comod.length + (precoMax ? 1 : 0) + (notaMin ? 1 : 0);

  const escolher = (k: Categoria) => { setCat(cat === k ? null : k); setSub(null); setProf(null); };

  return (
    <>
      <h1>Do que você precisa agora?</h1>
      <div className="busca">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="busca" type="search" placeholder="Buscar: vestiário, eletricista, garagem…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
      </div>

      <div className="row" style={{ margin: '12px 0 8px', flexWrap: 'nowrap' }}>
        <span className="meta sp">Uma categoria por vez, ou tudo.</span>
        <button className="btn sm ghost" disabled={!cat} onClick={() => { setCat(null); setSub(null); setProf(null); }}>Ver tudo</button>
      </div>
      <div className="cats">
        {ORDEM_CATEGORIAS.map((k) => (
          <button key={k} className="cat" style={{ ['--c' as string]: CATEGORIAS[k].cor }} aria-pressed={cat === k} onClick={() => escolher(k)}><i />{CATEGORIAS[k].curto ?? CATEGORIAS[k].nome}</button>
        ))}
      </div>
      {cat && (
        <div className="chips" style={{ marginTop: 12 }}>
          {Object.entries(CATEGORIAS[cat].subs).map(([k, n]) => <button key={k} className="chip" aria-pressed={sub === k} onClick={() => { setSub(sub === k ? null : k); setProf(null); }}>{n}</button>)}
        </div>
      )}
      {cat === 'servicos' && sub && (
        <div className="chips" style={{ marginTop: 8 }}>
          {Object.entries(PROFISSOES[sub]).map(([k, n]) => <button key={k} className="chip" aria-pressed={prof === k} onClick={() => setProf(prof === k ? null : k)}>{n}</button>)}
        </div>
      )}

      <details className="box painel" open={filtros} onToggle={(e) => setFiltros((e.target as HTMLDetailsElement).open)}>
        <summary>Mais filtros{nFiltros ? <span className="coin" style={{ marginLeft: 8 }}>{nFiltros}</span> : null}</summary>
        <div className="chips" style={{ marginTop: 12 }}>
          {Object.entries(COMODIDADES).map(([k, n]) => <button key={k} className="chip" aria-pressed={comod.includes(k)} onClick={() => setComod(comod.includes(k) ? comod.filter((x) => x !== k) : [...comod, k])}>{n}</button>)}
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="campo">Preço até<select value={precoMax} onChange={(e) => setPrecoMax(Number(e.target.value))}>{[0, 5, 10, 20, 50, 100, 500, 2000].map((v) => <option key={v} value={v}>{v ? `R$ ${v}` : 'Qualquer'}</option>)}</select></label>
          <label className="campo">Nota mínima<select value={notaMin} onChange={(e) => setNotaMin(Number(e.target.value))}>{[0, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `★ ${virgula(v)} ou mais` : 'Qualquer'}</option>)}</select></label>
        </div>
      </details>

      <div className="row" style={{ marginTop: 14 }}>
        <span className="meta">Raio: <span className="num">{formatarDistancia(raio)}</span></span>
      </div>
      <input type="range" min={0.3} max={5} step={0.1} value={raio} onChange={(e) => setRaio(Number(e.target.value))} aria-label="Raio de busca" />

      <div className="mapbox">
        <MapContainer center={[centro.lat, centro.lng]} zoom={14} zoomControl={false} attributionControl>
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
          <SeguirCentro centro={centro} />
          <CliqueParaMover ativo={mudarPonto} onMover={(p) => { setCentro(p); setSeguindoGps(false); setMudarPonto(false); toast('Ponto de busca atualizado'); }} />
          {colorir && <CamadaSemaforo centro={centro} />}
          <Circle center={[centro.lat, centro.lng]} radius={raio * 1000} pathOptions={{ color: '#4C8DFF', weight: 1.5, fillColor: '#4C8DFF', fillOpacity: 0.08 }} />
          <Marker position={[centro.lat, centro.lng]} icon={iconeEu} />
          {lista.map(({ a, d }) => (
            <Marker key={a.id} position={[a.lat, a.lng]} icon={iconePin(a, d > raio)}
              eventHandlers={{ click: () => document.getElementById(`a-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} />
          ))}
        </MapContainer>
        <div className="mapcount"><span className="coin">{noRaio.length} no raio</span></div>
        <Semaforo centro={centro} colorir={colorir} setColorir={setColorir} />
        <div className="mapbtns">
          <button className={mudarPonto ? 'on' : ''} onClick={() => setMudarPonto(!mudarPonto)} aria-label="Mudar ponto de busca" title="Mudar ponto de busca">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
          </button>
          {gps && !seguindoGps && <button onClick={() => setSeguindoGps(true)} aria-label="Voltar para minha localização" title="Minha localização"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2l7 19-7-4-7 4z" /></svg></button>}
        </div>
        {mudarPonto && <div className="picknote">Toque onde você vai estar</div>}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>{gps ? (seguindoGps ? 'Usando sua localização.' : 'Usando o ponto que você escolheu.') : 'Sem acesso à sua localização: mostrando o centro da cidade piloto.'}</p>

      <h2>{noRaio.length} {noRaio.length === 1 ? 'lugar' : 'lugares'} até {formatarDistancia(raio)}</h2>
      <div className="stack">
        {noRaio.map(({ a, d }) => (
          <Link key={a.id} id={`a-${a.id}`} to={`/anuncio/${a.id}`} className="box listrow">
            <Miniatura a={a} />
            <div>
              <span className="t">{a.titulo}</span>
              <span className="meta">{formatarDistancia(d)} · {nomeSub(a)}{a.metragemM2 ? ` · ${a.metragemM2} m²` : ''} · <span className="num">★ {virgula(nota(a))}</span></span>
              <span className="coin">{rotuloPreco(a)}</span>
            </div>
          </Link>
        ))}
        {!noRaio.length && <div className="empty">Nada nesse raio{termo ? ` para "${busca}"` : ''}. Aumente o raio, tire filtros ou escolha outra categoria.</div>}
      </div>
    </>
  );
}
