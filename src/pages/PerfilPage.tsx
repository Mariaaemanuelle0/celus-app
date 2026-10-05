import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIAS } from '../data/catalogo';
import { Visualizador } from '../components/Stories';
import { Miniatura, Moeda, Voltar, toast } from '../components/ui';
import { brl } from '../lib/format';
import { idade } from '../lib/regras';
import { alternarAlbum, alternarEquipe, resgatar, sair, storiesVisiveis } from '../store/acoes';
import { apagarTudo, carteiraDe, useDB, useUsuario } from '../store/db';
import { GANHOS } from '../lib/regras';

const STATUS: Record<string, string> = { confirmada: 'Confirmada', em_uso: 'Em uso', concluida: 'Concluída', cancelada: 'Cancelada', solicitado: 'Chamado enviado', aceito: 'Aceito', a_caminho: 'A caminho' };
const data = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export function PerfilPage() {
  const u = useUsuario()!;
  const nav = useNavigate();
  const [aba, setAba] = useState<'reservas' | 'sonhos' | 'avaliacoes'>('reservas');
  const [verStories, setVerStories] = useState(false);
  const reservas = useDB((d) => d.reservas);
  const anuncios = useDB((d) => d.anuncios);
  const sonhos = useDB((d) => d.sonhos);
  const avaliacoes = useDB((d) => d.avaliacoes);
  const stories = useDB((d) => d.stories);
  const denuncias = useDB((d) => d.denuncias);
  const saldo = useDB((d) => carteiraDe(d, u.id).saldo);
  const [confirmaApagar, setConfirmaApagar] = useState(false);

  const minhas = reservas.filter((r) => r.userId === u.id);
  const meusSonhos = sonhos.filter((s) => s.userId === u.id).map((s) => anuncios.find((a) => a.id === s.anuncioId)).filter(Boolean);
  const recebidas = avaliacoes.filter((a) => a.alvo === 'usuario' && a.alvoId === u.id);
  const media = recebidas.length ? recebidas.reduce((s, a) => s + (a.nota ?? 0), 0) / recebidas.length : null;
  const meusStories = storiesVisiveis(stories, denuncias).filter((s) => s.autorId === u.id && s.noPerfil);
  const iniciais = u.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
        <button className={`avatar ${meusStories.length ? 'comstory' : ''}`} onClick={() => meusStories.length && setVerStories(true)} aria-label="Seus stories">{iniciais}</button>
        <div className="sp" style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 21, margin: 0 }}>{u.nome}</h1>
          <div className="meta">{u.verificacao === 'verificado' ? 'Identidade verificada' : 'Identidade não verificada'}{media ? `. Nota ${media.toFixed(1).replace('.', ',')} como hóspede` : ''}</div>
        </div>
      </div>
      {verStories && <Visualizador lista={meusStories} fechar={() => setVerStories(false)} />}
      {u.verificacao !== 'verificado' && <Link to="/verificar" className="alerta warn" style={{ display: 'block', marginTop: 14, textDecoration: 'none', color: 'var(--text)' }}><b>Verifique sua identidade</b> para liberar chat, stories e estadias.</Link>}

      <Link to="/celus" className="walletmini">
        <span className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><Moeda tamanho={26} /><span><span className="eyebrow" style={{ display: 'block' }}>Meus celus</span><b className="num" style={{ fontSize: 20, fontWeight: 500 }}>{saldo}</b></span></span>
        <span className="hint">Ver e trocar ›</span>
      </Link>

      <div className="kpis">
        {([['reservas', 'Reservas', minhas.length], ['sonhos', 'Sonhos', meusSonhos.length], ['avaliacoes', 'Avaliações', recebidas.length]] as const).map(([k, t, n]) => (
          <button key={k} className="box kpi" aria-pressed={aba === k} onClick={() => setAba(k)}><b className="num">{n}</b><span>{t}</span></button>
        ))}
      </div>

      {aba === 'reservas' && (
        <div className="stack" style={{ marginTop: 16 }}>
          {minhas.length ? minhas.map((r) => {
            const a = anuncios.find((x) => x.id === r.anuncioId);
            if (!a) return null;
            return (
              <Link key={r.id} to={r.status === 'em_uso' ? `/uso/${r.id}` : `/reserva/${r.id}`} className="box listrow">
                <Miniatura a={a} />
                <div><span className="t">{a.titulo}</span><span className="meta">{STATUS[r.status]}, {data(r.inicio)}, <span className="num">{brl(r.total)}</span></span>
                  {r.status === 'concluida' && !r.avaliadaPeloUsuario && <span className="status pendente">Falta avaliar</span>}</div>
              </Link>
            );
          }) : <div className="empty">Nenhuma reserva ainda. <Link to="/">Abrir o mapa</Link></div>}
        </div>
      )}

      {aba === 'sonhos' && (
        <>
          <div className="row" style={{ margin: '16px 0 10px' }}><span className="meta sp">Seu livro dos sonhos está {u.albumPublico ? 'público' : 'privado'}</span>
            <div className="seg"><button aria-pressed={!u.albumPublico} onClick={() => u.albumPublico && alternarAlbum()}>Privado</button><button aria-pressed={u.albumPublico} onClick={() => !u.albumPublico && alternarAlbum()}>Público</button></div></div>
          {meusSonhos.length ? <div className="grid2">{meusSonhos.map((a) => a && (
            <Link key={a.id} to={`/anuncio/${a.id}`} className="box sonho"><Miniatura a={a} /><span className="t">{a.titulo}</span><span className="hint">{CATEGORIAS[a.categoria].nome} · {a.totalSonhos} sonham</span></Link>
          ))}</div> : <div className="empty">Toque no coração de qualquer lugar para guardar aqui.</div>}
        </>
      )}

      {aba === 'avaliacoes' && (
        <div style={{ marginTop: 16 }}>
          <p className="hint">Notas que os anfitriões deram para você. Só estrelas, sem comentários.</p>
          {recebidas.length ? recebidas.map((a) => (
            <div key={a.id} className="review row"><span className="sp">{anuncios.find((x) => x.id === reservas.find((r) => r.id === a.reservaId)?.anuncioId)?.titulo ?? 'Anfitrião'}</span><span className="estrelas">{'★'.repeat(a.nota ?? 0)}<span style={{ opacity: .25 }}>{'★'.repeat(5 - (a.nota ?? 0))}</span></span></div>
          )) : <div className="empty">Ainda sem avaliações. Elas aparecem depois que um anfitrião avaliar você.</div>}
        </div>
      )}

      <h2>Conta</h2>
      <div className="box infos" style={{ marginTop: 0 }}>
        <div className="sumline"><span>E-mail</span><span className="hint">{u.email}</span></div>
        <div className="sumline"><span>Idade</span><span className="hint">{idade(u.nascimento)} anos</span></div>
        <label className="sumline check" style={{ border: 0 }}><span>Sou da equipe Celus (curadoria)</span><input type="checkbox" checked={u.equipeCelus} onChange={alternarEquipe} /></label>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={() => { sair(); nav('/entrar'); }}>Sair da conta</button>
        {!confirmaApagar ? <button className="back" onClick={() => setConfirmaApagar(true)}>Apagar todos os dados de teste deste aparelho</button>
          : <div className="alerta bad">Isso apaga contas, reservas e anúncios de teste deste aparelho. <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { apagarTudo(); nav('/entrar'); }}>Apagar</button><button className="btn sm ghost" onClick={() => setConfirmaApagar(false)}>Cancelar</button></div></div>}
      </div>
    </>
  );
}

const GRUPOS = { local: ['Nos espaços', 'Brindes e descontos oferecidos pelos próprios locais.'], evento: ['Eventos e lazer Celus', 'Promovidos pela Celus.'], celus: ['Da Celus', 'Vantagens dentro do app.'], anfitriao: ['Para quem anuncia', 'Use celus para vender mais. Nada disso vira dinheiro.'] } as const;

export function CelusPage() {
  const uid = useDB((d) => d.sessao)!;
  const c = useDB((d) => d.carteiras[uid]);
  const beneficios = useDB((d) => d.beneficios);
  const saldo = c?.saldo ?? 0;
  const quando = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };
  return (
    <>
      <Voltar para="/perfil" />
      <div className="walletcard">
        <div className="eyebrow">Meus celus</div>
        <div className="row" style={{ marginTop: 8 }}><Moeda tamanho={34} /><b className="num" style={{ fontSize: 38, fontWeight: 500 }}>{saldo}</b></div>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>Funciona como milhas. Não vale dinheiro, não compra, não vende e não transfere.</p>
      </div>
      {!!c?.vales.length && <><h2>Seus vales</h2><div className="stack">{c.vales.map((v) => <div key={v.codigo} className="box linha"><div className="sp"><b>{v.nome}</b><div className="hint">{v.onde} · mostre o código no local</div></div><span className="code num" style={{ fontSize: 16 }}>{v.codigo}</span></div>)}</div></>}
      {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map((g) => (
        <div key={g}>
          <h2>{GRUPOS[g][0]}</h2><p className="hint" style={{ margin: '-6px 0 10px' }}>{GRUPOS[g][1]}</p>
          <div className="stack">{beneficios.filter((b) => b.grupo === g).map((b) => (
            <div key={b.id} className="box linha"><div className="sp"><b>{b.nome}</b><div className="hint">{b.desc}</div></div>
              <button className="btn sm" disabled={saldo < b.custo} onClick={() => { const cod = resgatar(b.id); toast(cod ? `${b.nome} resgatado. Código ${cod}` : 'Saldo insuficiente'); }}><Moeda tamanho={14} /> <span className="num">{b.custo}</span></button></div>
          ))}</div>
        </div>
      ))}
      <h2>Como ganhar</h2>
      <div className="box" style={{ padding: '4px 14px' }}>{GANHOS.map((g) => <div key={g.chave} className="sumline"><span>{g.txt}{g.limite ? <span className="hint"> · até {g.limite} por dia</span> : null}</span><span style={{ color: 'var(--accent-2)' }}>+{g.v}</span></div>)}</div>
      <h2>Extrato</h2>
      {c?.hist.length ? <div className="box" style={{ padding: '4px 14px' }}>{c.hist.slice(0, 30).map((h, i) => <div key={i} className="sumline"><span>{h.txt}<div className="hint">{quando(h.t)}</div></span><span style={{ color: h.v > 0 ? 'var(--ok)' : 'var(--muted)' }}>{h.v > 0 ? '+' : ''}{h.v}</span></div>)}</div>
        : <div className="empty">Você ainda não ganhou celus. Reserve, avalie ou marque o semáforo para começar.</div>}
    </>
  );
}
