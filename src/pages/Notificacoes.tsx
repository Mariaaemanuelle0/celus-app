import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { marcarLidas } from '../store/acoes';
import { useDB } from '../store/db';

const quando = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export function Notificacoes() {
  const todas = useDB((d) => d.notificacoes);
  const uid = useDB((d) => d.sessao);
  const lista = useMemo(() => todas.filter((n) => n.userId === uid), [todas, uid]);
  // Ao sair da tela, tudo que foi visto fica como lido.
  useEffect(() => () => marcarLidas(), []);
  return (
    <>
      <h1>Notificações</h1>
      {lista.length ? (
        <div className="notifs">{lista.map((n) => {
          const corpo = <><span className={`ponto ${n.lida ? '' : 'novo'}`} /><span className="sp">{n.txt}<span className="hint" style={{ display: 'block' }}>{quando(n.t)}</span></span></>;
          return n.link ? <Link key={n.id} to={n.link} className="notif">{corpo}</Link> : <div key={n.id} className="notif">{corpo}</div>;
        })}</div>
      ) : <div className="empty">Nada por aqui ainda. Reservas, chamados e avaliações aparecem nesta lista.</div>}
      <p className="hint" style={{ marginTop: 14 }}>No app instalado, estes avisos também chegam como notificação no celular quando o servidor for ligado.</p>
    </>
  );
}
