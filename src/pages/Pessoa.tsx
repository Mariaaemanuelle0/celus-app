import { Link, useParams } from 'react-router-dom';
import { Voltar } from '../components/ui';
import { useDB, useUsuario } from '../store/db';
import { PRIVACIDADE_PADRAO, useBlocosPerfil } from '../lib/perfil';

export function Pessoa() {
  const { id = '' } = useParams();
  const eu = useUsuario()!;
  const p = useDB((d) => d.usuarios[id]);
  const b = useBlocosPerfil(id);
  if (!p) return <><Voltar /><div className="empty">Perfil não encontrado.</div></>;
  const priv = p.privacidade ?? PRIVACIDADE_PADRAO;
  const proprio = eu.id === p.id;
  const ano = (t: number) => new Date(t).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  const nada = !priv.comunidades && !priv.eventos && !priv.lugares;
  return (
    <>
      <Voltar />
      <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
        <span className="avatar">{p.foto ? <img src={p.foto} alt="" /> : p.nome.slice(0, 1)}</span>
        <div className="sp"><h1 style={{ fontSize: 21, margin: 0 }}>{p.nome.split(' ')[0]}</h1>
          <div className="meta">{p.verificacao === 'verificado' ? 'Identidade verificada' : 'Identidade não verificada'}. Na Celus desde {ano(p.criadoEm)}</div></div>
      </div>
      {p.bio && <p className="desc" style={{ margin: '12px 0 0' }}>{p.bio}</p>}
      {proprio && <p className="hint" style={{ marginTop: 10 }}>É assim que as outras pessoas veem seu perfil. Escolha o que aparece no seu Perfil.</p>}

      {priv.comunidades && <><h2>Comunidades</h2>
        {b.comu.length ? <div className="chips">{b.comu.map((c) => <Link key={c.id} to={`/comunidade/${c.id}`} className="chip">{c.nome}</Link>)}</div> : <div className="empty">Ainda não participa de nenhuma.</div>}</>}
      {priv.eventos && <><h2>Eventos</h2>
        {b.eventos.length ? <div className="box" style={{ padding: '4px 14px' }}>{b.eventos.slice(0, 12).map((e) => <Link key={e.id} to={e.link} className="sumline" style={{ color: 'var(--text)', textDecoration: 'none' }}><span>{e.nome}</span><span className="hint">{ano(e.t)}</span></Link>)}</div> : <div className="empty">Nenhum evento ainda.</div>}</>}
      {priv.lugares && <><h2>Lugares</h2>
        {b.lugares.length ? <div className="chips">{b.lugares.slice(0, 20).map((a) => <Link key={a.id} to={`/anuncio/${a.id}`} className="chip">{a.titulo}</Link>)}</div> : <div className="empty">Nenhum lugar ainda.</div>}</>}
      {nada && <div className="empty" style={{ marginTop: 16 }}>{p.nome.split(' ')[0]} preferiu deixar o perfil reservado.</div>}
    </>
  );
}
