import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDB, useUsuario } from '../store/db';
import { cobranca } from '../lib/regras';
import { Toasts, useAgora } from './ui';

/** Símbolo da Celus: versão simplificada do polvo, feita para tamanhos pequenos. */
export function Marca() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="#3A7BF5" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 31.5 C15 33.5 8.5 32 7.3 26.2 C6.8 23.4 8.6 21.4 10.8 21.8" />
        <path d="M25 35 C16 39.5 9 45.5 9.8 52.2 C10.2 55.2 12.8 56.4 14.8 55.2" />
        <path d="M30.5 36 C31 44.5 30.4 50.8 27.3 54.4 C25.3 56.6 22.3 56 22.1 53.2" />
        <path d="M35.5 35 C45.5 38.8 55.6 43.4 54.9 51.4 C54.6 54.7 51.7 55.9 49.7 54.5" />
        <path d="M38 32 C47 34.6 55.6 32.4 55.1 25 C54.9 22.3 52.7 21.2 50.9 22.4" />
      </g>
      <ellipse cx="30.5" cy="30.5" rx="8.5" ry="6" fill="#3A7BF5" />
      <circle cx="27" cy="19" r="13.5" fill="#4C8DFF" />
      <path d="M36.5 31 C46 29.5 41.6 8.6 50 6.9 C53 6.3 55.4 8.1 55 10.7" fill="none" stroke="#4C8DFF" strokeWidth="4.2" strokeLinecap="round" />
      <ellipse cx="21.5" cy="11.5" rx="3.6" ry="2.4" fill="#fff" opacity=".22" transform="rotate(-30 21.5 11.5)" />
      <circle cx="29" cy="21" r="3.4" fill="#fff" /><circle cx="30" cy="21.3" r="1.75" fill="#03050A" />
      <circle cx="36.6" cy="21" r="3" fill="#fff" /><circle cx="37.5" cy="21.3" r="1.55" fill="#03050A" />
    </svg>
  );
}

const ic = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

const PROCURAR = [
  { to: '/', nome: 'Mapa', d: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></> },
  { to: '/feed', nome: 'Feed', d: <><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /></> },
  { to: '/chat', nome: 'Chat', d: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></> },
  { to: '/perfil', nome: 'Perfil', d: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
];
const RENDA = [
  { to: '/renda', nome: 'Painel', d: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { to: '/renda/anunciar', nome: 'Anunciar', d: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></> },
  { to: '/renda/curadoria', nome: 'Curadoria', d: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></> },
];

function EmUso() {
  const agora = useAgora();
  const uid = useDB((d) => d.sessao);
  const reservas = useDB((d) => d.reservas);
  const anuncios = useDB((d) => d.anuncios);
  const r = reservas.find((x) => x.userId === uid && x.status === 'em_uso');
  const a = r && anuncios.find((x) => x.id === r.anuncioId);
  if (!r || !a) return null;
  const c = cobranca(r, a, agora);
  const min = Math.abs(c.restanteMin), s = Math.round(min * 60);
  return (
    <Link to={`/uso/${r.id}`} className="live">
      <span className="dot" /><span className="sp t">Em uso agora: {a.titulo}</span>
      <span className="num">{c.restanteMin < 0 ? '+' : ''}{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
    </Link>
  );
}

export function Layout() {
  const u = useUsuario();
  const loc = useLocation();
  const nav = useNavigate();
  if (!u) return <Navigate to="/entrar" replace />;
  const renda = loc.pathname.startsWith('/renda');
  const abas = renda ? RENDA : PROCURAR;
  const mostrarEmUso = !renda && !loc.pathname.startsWith('/uso') && loc.pathname !== '/chat';

  return (
    <div className="shell">
      <div className="app">
        <header className="top">
          <Link to="/" className="logo" aria-label="Celus, início"><Marca /><span>Celus</span></Link>
          <div className="layer" role="group" aria-label="Camada">
            <button aria-pressed={!renda} onClick={() => nav('/')}>Procurar</button>
            <button aria-pressed={renda} onClick={() => nav('/renda')}>Rentabilizar</button>
          </div>
        </header>
        <main className={loc.pathname === '/' ? 'cheio' : ''}><Outlet /></main>
        {mostrarEmUso && <div className="live-wrap"><EmUso /></div>}
        <nav className="tabs" style={{ gridTemplateColumns: `repeat(${abas.length}, 1fr)` }} aria-label="Navegação">
          {abas.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.to === '/' || a.to === '/renda'}>{ic(a.d)}{a.nome}</NavLink>
          ))}
        </nav>
        <Toasts />
      </div>
    </div>
  );
}
