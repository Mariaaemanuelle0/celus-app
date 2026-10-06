import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapaGL, Marker } from 'maplibre-gl';
import { ESTILO_CELUS } from '../lib/estiloMapa';
import { buscarEndereco, type Lugar } from '../lib/endereco';
import type { Ponto } from '../lib/geo';

const ESTILO_EXTERNO = import.meta.env.VITE_MAP_STYLE_URL as string | undefined;

/** Escolher onde fica o anúncio: busca por endereço, "usar onde estou" ou arrastar o pin. */
export function EscolherLocal({ valor, onChange, gps }: { valor: Ponto; onChange: (p: Ponto) => void; gps: Ponto | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const pino = useRef<Marker | null>(null);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const cb = useRef(onChange); cb.current = onChange;

  useEffect(() => {
    if (!caixa.current) return;
    let m: MapaGL;
    try { m = new maplibregl.Map({ container: caixa.current, style: ESTILO_EXTERNO || ESTILO_CELUS, center: [valor.lng, valor.lat], zoom: 16, attributionControl: { compact: true } }); }
    catch { return; }
    mapa.current = m;
    const el = document.createElement('div'); el.className = 'pino-local';
    pino.current = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([valor.lng, valor.lat]).addTo(m);
    pino.current.on('dragend', () => { const ll = pino.current!.getLngLat(); cb.current({ lat: ll.lat, lng: ll.lng }); });
    m.on('click', (e) => { pino.current!.setLngLat(e.lngLat); cb.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    return () => { m.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o valor muda por fora (busca ou GPS), move o pin e o mapa.
  useEffect(() => {
    const ll = pino.current?.getLngLat();
    if (ll && Math.abs(ll.lat - valor.lat) < 1e-7 && Math.abs(ll.lng - valor.lng) < 1e-7) return;
    pino.current?.setLngLat([valor.lng, valor.lat]);
    mapa.current?.easeTo({ center: [valor.lng, valor.lat], duration: 500 });
  }, [valor.lat, valor.lng]);

  async function buscar() {
    setErro(''); setBuscando(true);
    try { const r = await buscarEndereco(q, valor); setRes(r); if (!r.length) setErro('Não achamos esse endereço. Tente com rua, número e cidade.'); }
    catch (e) { setErro((e as Error).message); }
    finally { setBuscando(false); }
  }

  return (
    <div className="escolher-local">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input id="a-endereco" placeholder="Rua, número, bairro e cidade" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }} aria-label="Endereço" />
        <button type="button" className="btn sm" disabled={q.trim().length < 3 || buscando} onClick={buscar}>{buscando ? 'Buscando' : 'Buscar'}</button>
      </div>
      {erro && <p className="erro" style={{ fontSize: 13, marginTop: 6 }}>{erro}</p>}
      {res && res.length > 0 && (
        <div className="resultados">{res.map((r) => (
          <button type="button" key={`${r.lat},${r.lng}`} onClick={() => { onChange({ lat: r.lat, lng: r.lng }); setRes(null); setQ(r.nome); }}>{r.nome}</button>
        ))}</div>
      )}
      <div ref={caixa} className="mini-mapa" />
      <div className="row" style={{ marginTop: 8 }}>
        <span className="hint sp">Arraste o pin ou toque no mapa para ajustar a entrada exata.</span>
        {gps && <button type="button" className="btn sm ghost" onClick={() => onChange(gps)}>Usar onde estou</button>}
      </div>
    </div>
  );
}
