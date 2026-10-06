import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS } from '../data/catalogo';
import type { Anuncio, Categoria } from '../data/types';

/* ---------- Avisos rápidos ---------- */
let mostrar: (t: string) => void = () => {};
export const toast = (t: string) => mostrar(t);
export function Toasts() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number;
    mostrar = (t) => { setMsg(t); clearTimeout(timer); timer = window.setTimeout(() => setMsg(null), 2600); };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

/* ---------- Relógio que re-renderiza ---------- */
export function useAgora(ms = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return t;
}

export function Voltar({ para }: { para?: string }) {
  const nav = useNavigate();
  return <button className="back" onClick={() => (para ? nav(para) : nav(-1))}>‹ Voltar</button>;
}

const ICONES: Record<Categoria, ReactNode> = {
  banheiro: <path d="M12 3.5c3.4 4.3 5.8 7.3 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-3.3 2.4-6.3 5.8-10.6z" />,
  descanso: <path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z" />,
  trabalho: <><rect x="5" y="5.5" width="14" height="9.5" rx="1.5" /><path d="M3 18.5h18" /></>,
  ficar: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  eventos: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5" /></>,
  imoveis: <><circle cx="8" cy="15" r="4" /><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5" /></>,
  estacionamento: <><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M10 16.5V7.5h3.2a2.6 2.6 0 0 1 0 5.2H10" /></>,
  servicos: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5h6v2M3.5 12.5h17" /></>,
};

/** Ícone de linha da categoria, herda a cor do texto. */
export function IconeCategoria({ c, tamanho = 18 }: { c: Categoria; tamanho?: number }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONES[c]}</svg>;
}

/** Foto do anúncio. Sem foto, mostra uma capa da categoria (nunca um bloco vazio). */
export function Miniatura({ a, grande }: { a: Anuncio; grande?: boolean }) {
  const cor = CATEGORIAS[a.categoria].cor;
  if (a.fotos[0]) return <img className={grande ? 'hero' : 'thumb'} src={a.fotos[0]} alt="" />;
  return (
    <span className={`${grande ? 'hero' : 'thumb'} capa`} style={{ ['--c' as string]: cor }} aria-hidden="true">
      <span className="capa-ic"><IconeCategoria c={a.categoria} tamanho={grande ? 120 : 30} /></span>
    </span>
  );
}

export function Estrelas({ valor, onChange, rotulo }: { valor: number; onChange: (n: number) => void; rotulo: string }) {
  return (
    <div className="stars" role="radiogroup" aria-label={rotulo}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} className={valor >= n ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} de 5`}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
        </button>
      ))}
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <><h2>{titulo}</h2>{children}</>;
}

export function Moeda({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A9C8FF" /><stop offset="1" stopColor="#2F6BEA" /></linearGradient></defs>
      <circle cx="12" cy="12" r="10" fill="url(#cg)" />
      <path d="M12 7l1.5 3.2 3.5.5-2.5 2.4.6 3.4L12 15l-3.1 1.5.6-3.4L7 10.7l3.5-.5z" fill="#05070C" fillOpacity=".55" />
    </svg>
  );
}

/** Lê uma imagem escolhida pela pessoa, reduzida para no máximo 1080 px. */
export function lerImagem(file: File, max = 1080): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onerror = erro;
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = erro;
      img.src = r.result as string;
    };
    r.readAsDataURL(file);
  });
}

/** Localização atual da pessoa (ou null se ela não permitir). */
export function useLocalizacao() {
  const [p, setP] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((x) => setP({ lat: x.coords.latitude, lng: x.coords.longitude }), () => {}, { enableHighAccuracy: true, maximumAge: 30_000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return p;
}
