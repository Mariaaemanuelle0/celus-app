import { NavLink, Outlet } from 'react-router-dom';

export function Marca() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="mg" x1="8" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A9C8FF" /><stop offset=".55" stopColor="#4C8DFF" /><stop offset="1" stopColor="#2450C8" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#mg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 26a13 13 0 0 1 26 0v2H11z" />
        <path d="M14 28c0 5-2.5 7.5-5 11" /><path d="M20.5 28c0 5-1 8-3 12" /><path d="M27.5 28c0 5 1 8 3 12" /><path d="M34 28c0 5 2.5 7.5 5 11" />
        <circle cx="19.5" cy="21.5" r="1.7" fill="#A9C8FF" stroke="none" /><circle cx="28.5" cy="21.5" r="1.7" fill="#A9C8FF" stroke="none" />
      </g>
    </svg>
  );
}

const ABAS = [
  { to: '/', nome: 'Mapa', d: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></> },
  { to: '/feed', nome: 'Feed', d: <><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /></> },
  { to: '/chat', nome: 'Chat', d: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></> },
  { to: '/perfil', nome: 'Perfil', d: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
];

export function Layout() {
  return (
    <div className="shell">
      <div className="app">
        <header className="top">
          <div className="logo"><Marca />Celus</div>
          <div className="layer" role="group" aria-label="Camada">
            <button aria-pressed="true">Procurar</button>
            <button aria-pressed="false" title="Chega na etapa 2">Rentabilizar</button>
          </div>
        </header>
        <main><Outlet /></main>
        <nav className="tabs" aria-label="Navegação">
          {ABAS.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.to === '/'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{a.d}</svg>
              {a.nome}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
