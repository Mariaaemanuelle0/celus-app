import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS } from '../data/catalogo';
import type { Anuncio } from '../data/types';

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

export function Miniatura({ a, grande }: { a: Anuncio; grande?: boolean }) {
  const cor = CATEGORIAS[a.categoria].cor;
  if (a.fotos[0]) return <img className={grande ? 'hero' : 'thumb'} src={a.fotos[0]} alt="" />;
  return <span className={grande ? 'hero' : 'thumb'} style={{ ['--c' as string]: cor }} />;
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
export function lerImagem(file: File): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onerror = erro;
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1080, k = Math.min(1, max / Math.max(img.width, img.height));
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
