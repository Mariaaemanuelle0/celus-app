import { Suspense, useEffect } from 'react';
import { avisosDeEventos, bonusBoaNota, concluirEventosPassados, encerrarEncontrosPassados } from '../store/acoes';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDB, useUsuario } from '../store/db';
import { cobranca } from '../lib/regras';
import { Toasts, useAgora } from './ui';

/** Link aberto sem estar logado (ex.: QR da academia): volta para ele depois de entrar. */
function guardarVolta(caminho: string) {
  if (!caminho.startsWith('/saude/checkin')) return; // só links que a pessoa abre de fora (QR da recepção)
  try { sessionStorage.setItem('celus-volta', caminho); } catch { /* sem armazenamento */ }
}
export function destinoDepoisDeEntrar(): string {
  try { const v = sessionStorage.getItem('celus-volta'); sessionStorage.removeItem('celus-volta'); return v && v.startsWith('/') && !v.startsWith('//') ? v : '/'; } catch { return '/'; }
}

/** Símbolo da Celus: o polvo original da marca, sem fundo. */
export function Marca() {
  return <img className="marca" src="/polvo.png" alt="" aria-hidden="true" />;
}

const ic = (d: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

const PROCURAR = [
  { to: '/', nome: 'Mapa', d: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></> },
  { to: '/feed', nome: 'Feed', d: <><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /></> },
  { to: '/chat', nome: 'Chat', d: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></> },
  { to: '/perfil', nome: 'Perfil', d: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
];
/** Telas que se abrem a partir do Perfil: a aba Perfil continua acesa. */
const DENTRO_DO_PERFIL = /^\/(comunidade|trocas|troca|pessoa|celus|saude)(\/|$)/;

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

function Sino() {
  const n = useDB((d) => d.notificacoes.filter((x) => x.userId === d.sessao && !x.lida).length);
  return (
    <Link to="/notificacoes" className="sino" aria-label={n ? `Notificações, ${n} novas` : 'Notificações'}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
      {n > 0 && <b>{n > 9 ? '9+' : n}</b>}
    </Link>
  );
}

export function Layout() {
  const u = useUsuario();
  useEffect(() => { concluirEventosPassados(); avisosDeEventos(); encerrarEncontrosPassados(); bonusBoaNota(); }, []);
  const loc = useLocation();
  // Cada tela nova começa do topo.
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const nav = useNavigate();
  if (!u) { guardarVolta(loc.pathname + loc.search); return <Navigate to="/entrar" replace />; }
  const renda = loc.pathname.startsWith('/renda');
  const abas = renda ? RENDA : PROCURAR;
  const mostrarEmUso = !renda && !loc.pathname.startsWith('/uso') && loc.pathname !== '/chat';

  return (
    <div className="shell">
      <div className="app">
        <header className="top">
          <Link to="/" className="logo" aria-label="Celus, início"><Marca /><span>Celus</span></Link>
          <Sino />
          <div className="layer" role="group" aria-label="Camada">
            <button aria-pressed={!renda} onClick={() => nav('/')}>Procurar</button>
            <button aria-pressed={renda} onClick={() => nav('/renda')}>Rentabilizar</button>
          </div>
        </header>
        <main className={loc.pathname === '/' ? 'cheio' : ''}><Suspense fallback={<div className="carregando" aria-label="Carregando" />}><Outlet /></Suspense></main>
        {mostrarEmUso && <div className="live-wrap"><EmUso /></div>}
        <nav className="tabs" style={{ gridTemplateColumns: `repeat(${abas.length}, 1fr)` }} aria-label="Navegação">
          {abas.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.to === '/' || a.to === '/renda'} className={({ isActive }) => (isActive || (a.to === '/perfil' && DENTRO_DO_PERFIL.test(loc.pathname)) ? 'active' : '')}>{ic(a.d)}{a.nome}</NavLink>
          ))}
        </nav>
        <Toasts />
      </div>
    </div>
  );
}
