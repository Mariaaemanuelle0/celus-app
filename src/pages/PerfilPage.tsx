import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMISSAO_REDUZIDA } from '../lib/regras';
import { CATEGORIAS } from '../data/catalogo';
import { Visualizador } from '../components/Stories';
import { Miniatura, Moeda, Voltar, lerImagem, toast } from '../components/ui';
import { brl } from '../lib/format';
import { idade } from '../lib/regras';
import { alternarAlbum, alternarEquipe, alternarPrivacidade, atualizarPerfil, excluirConta, resgatar, resgatarAnfitriao, sair, storiesVisiveis } from '../store/acoes';
import { apagarTudo, carteiraDe, useDB, useUsuario } from '../store/db';
import { CELUS_EM_REAIS, GANHOS } from '../lib/regras';
import { NOME_TROCAS, useBlocosPerfil } from '../lib/perfil';
import { CartaoSaude } from './Saude';

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
  const reservado = useDB((d) => carteiraDe(d, u.id).reservado ?? 0);
  const blocos = useBlocosPerfil(u.id);
  const priv = u.privacidade ?? { comunidades: true, eventos: true, lugares: false };
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
        <button className={`avatar ${meusStories.length ? 'comstory' : ''}`} onClick={() => meusStories.length && setVerStories(true)} aria-label="Seus stories">{u.foto ? <img src={u.foto} alt="" /> : iniciais}</button>
        <div className="sp" style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 21, margin: 0 }}>{u.nome}</h1>
          <div className="meta">{u.verificacao === 'verificado' ? 'Identidade verificada' : 'Identidade não verificada'}{media ? `. Nota ${media.toFixed(1).replace('.', ',')} como hóspede` : ''}</div>
        </div>
      </div>
      {u.bio ? <p className="desc" style={{ margin: '12px 0 0' }}>{u.bio}</p> : null}
      {!u.bonus?.includes('perfil') && u.foto && u.verificacao === 'verificado' && <Link to="/perfil/editar" className="alerta ok" style={{ display: 'block', marginTop: 12, textDecoration: 'none', color: 'var(--text)' }}><b>Complete seu perfil e ganhe 50 celus.</b> Falta escrever sua bio.</Link>}
      <Link to="/perfil/editar" className="btn sm ghost" style={{ marginTop: 12 }}>{u.foto ? 'Editar perfil' : 'Tirar selfie para o perfil'}</Link>
      {verStories && <Visualizador lista={meusStories} fechar={() => setVerStories(false)} />}
      {!u.foto && <Link to="/perfil/editar" className="alerta warn" style={{ display: 'block', marginTop: 14, textDecoration: 'none', color: 'var(--text)' }}><b>Falta a foto do seu rosto.</b> Sem ela não dá para reservar, chamar profissional nem anunciar.</Link>}
      {u.verificacao !== 'verificado' && <Link to="/verificar" className="alerta warn" style={{ display: 'block', marginTop: 14, textDecoration: 'none', color: 'var(--text)' }}><b>Verifique sua identidade</b> para liberar chat, stories e estadias.</Link>}

      <Link to="/celus" className="walletmini">
        <span className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><Moeda tamanho={26} /><span><span className="eyebrow" style={{ display: 'block' }}>Meus celus</span><b className="num" style={{ fontSize: 20, fontWeight: 500 }}>{saldo}</b></span></span>
        <span className="hint" style={{ textAlign: 'right' }}>{reservado ? <>{reservado} guardados<br /></> : null}Ver e usar ›</span>
      </Link>

      <div className="entradas">
        <Link to="/comunidade" className="box entrada">
          <span className="entrada-ic comu-cor" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><path d="M15 14.5c3 0 6 1.5 6 4.5" /></svg></span>
          <b>Comunidades</b><span className="hint">{blocos.comu.length ? `Você está em ${blocos.comu.length}` : 'Gente que faz o mesmo que você, perto'}</span>
        </Link>
        <Link to="/trocas" className="box entrada">
          <span className="entrada-ic feira-cor" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9c0 1.7 1.3 3 3 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.3 3s2.3-1.3 2.3-3c0 1.7 1 3 2.7 3s3-1.3 3-3" /><path d="M5.5 12v8h13v-8" /></svg></span>
          <b>{NOME_TROCAS}</b><span className="hint">Troque o que não usa por celus</span>
        </Link>
      </div>

      <CartaoSaude />

      <h2>No seu perfil</h2>
      <p className="hint" style={{ margin: '-6px 0 10px' }}>Sem seguidores. Quem abre seu perfil vê só o que você deixar visível. <Link to={`/pessoa/${u.id}`}>Ver como os outros veem</Link></p>
      <div className="box" style={{ padding: '4px 14px' }}>
        {([['comunidades', 'Comunidades', blocos.comu.length], ['eventos', 'Eventos que fui', blocos.eventos.length], ['lugares', 'Lugares que usei', blocos.lugares.length]] as const).map(([k, t, n]) => (
          <label key={k} className="sumline priv"><span>{t} <span className="hint">({n})</span></span><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="hint">{priv[k] ? 'Visível' : 'Oculto'}</span><input type="checkbox" checked={priv[k]} onChange={() => alternarPrivacidade(k)} aria-label={`Mostrar ${t.toLowerCase()} no perfil`} /></span></label>
        ))}
      </div>
      {blocos.comu.length > 0 && <div className="chips" style={{ marginTop: 10 }}>{blocos.comu.map((c) => <Link key={c.id} to={`/comunidade/${c.id}`} className="chip">{c.nome}</Link>)}</div>}

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
            <Link key={a.id} to={`/anuncio/${a.id}`} className="box sonho"><Miniatura a={a} /><span className="t">{a.titulo}</span><span className="hint">{CATEGORIAS[a.categoria].nome}, {a.totalSonhos} sonham</span></Link>
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
        <Link to="/perfil/excluir" className="back" style={{ textDecoration: 'none' }}>Excluir minha conta</Link>
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
  const anunciosTodos = useDB((d) => d.anuncios);
  const meusNoMapa = anunciosTodos.filter((a) => a.donoId === uid && a.status === 'aprovado');
  const usuario = useDB((d) => d.usuarios[uid]);
  const [alvo, setAlvo] = useState('');
  const TIPO_HOST: Record<string, 'destaque' | 'comissao' | 'campanha'> = { 'b-dest': 'destaque', 'b-com': 'comissao', 'b-campa': 'campanha' };
  const quando = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };
  return (
    <>
      <Voltar para="/perfil" />
      <div className="walletcard">
        <div className="eyebrow">Meus celus</div>
        <div className="row" style={{ marginTop: 8 }}><Moeda tamanho={34} /><b className="num" style={{ fontSize: 38, fontWeight: 500 }}>{saldo}</b></div>
        {!!c?.reservado && <p className="hint" style={{ margin: '4px 0 0' }}>Mais <b className="num">{c.reservado}</b> guardados em cauções e trocas em andamento.</p>}
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>Referência: 1 celus = R$ {CELUS_EM_REAIS}. Celus não se saca nem se compra com dinheiro: você ganha usando o app e usa em benefícios, cauções de encontros e no {NOME_TROCAS}.</p>
      </div>
      {!!c?.vales.length && <><h2>Seus vales</h2><div className="stack">{c.vales.map((v) => <div key={v.codigo} className="box linha"><div className="sp"><b>{v.nome}</b><div className="hint">{v.onde}. Mostre o código no local</div></div><span className="code num" style={{ fontSize: 16 }}>{v.codigo}</span></div>)}</div></>}
      {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map((g) => (
        <div key={g}>
          <h2>{GRUPOS[g][0]}</h2><p className="hint" style={{ margin: '-6px 0 10px' }}>{GRUPOS[g][1]}</p>
          {g === 'anfitriao' && meusNoMapa.length > 1 && (
            <label className="campo" style={{ marginBottom: 10 }}>Usar no anúncio<select value={alvo} onChange={(e) => setAlvo(e.target.value)}>{meusNoMapa.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}</select></label>
          )}
          {g === 'anfitriao' && !meusNoMapa.length && <p className="hint" style={{ margin: '0 0 10px' }}>Fica disponível quando você tiver um anúncio publicado no mapa.</p>}
          {g === 'anfitriao' && usuario?.comissaoReduzidaAte && usuario.comissaoReduzidaAte > Date.now() && <p className="hint" style={{ margin: '0 0 10px', color: 'var(--ok)' }}>Sua comissão está em {Math.round(COMISSAO_REDUZIDA * 100)}% até {new Date(usuario.comissaoReduzidaAte).toLocaleDateString('pt-BR')}.</p>}
          <div className="stack">{beneficios.filter((b) => b.grupo === g).map((b) => (
            <div key={b.id} className="box linha"><div className="sp"><b>{b.nome}</b><div className="hint">{b.desc}</div></div>
              <button className="btn sm" disabled={saldo < b.custo || (g === 'anfitriao' && !meusNoMapa.length)} onClick={() => {
                if (g === 'anfitriao') { const r = resgatarAnfitriao(TIPO_HOST[b.id], alvo || undefined); toast(r.ok ? `${b.nome}: ativado` : r.erro); return; }
                const cod = resgatar(b.id); toast(cod ? `${b.nome} resgatado. Código ${cod}` : 'Saldo insuficiente');
              }}><Moeda tamanho={14} /> <span className="num">{b.custo}</span></button></div>
          ))}</div>
        </div>
      ))}
      <h2>Outros usos</h2>
      <div className="stack">
        <Link to="/trocas" className="box linha" style={{ color: 'var(--text)', textDecoration: 'none' }}><div className="sp"><b>{NOME_TROCAS}</b><div className="hint">Pegue itens de quem não usa mais e anuncie os seus. Quem entrega recebe os celus.</div></div><span>›</span></Link>
        <Link to="/comunidade" className="box linha" style={{ color: 'var(--text)', textDecoration: 'none' }}><div className="sp"><b>Caução de encontros</b><div className="hint">Confirme presença em aulas e encontros. Foi, os celus voltam. Faltou sem cancelar no prazo, vão para quem organizou.</div></div><span>›</span></Link>
      </div>
      <h2>Como ganhar</h2>
      <div className="box" style={{ padding: '4px 14px' }}>{GANHOS.map((g) => <div key={g.chave} className="sumline"><span>{g.txt}<span className="hint">{g.limite ? `, até ${g.limite} por dia` : g.unico ? ', uma vez' : g.mensal ? ', todo mês' : ''}</span>{(g.unico && usuario?.bonus?.includes(g.chave)) || (g.mensal && usuario?.bonusNotaMes === new Date().toISOString().slice(0, 7)) ? <span className="hint" style={{ color: 'var(--ok)' }}> (feito)</span> : null}</span><span style={{ color: 'var(--accent-2)' }}>+{g.v}</span></div>)}</div>
      <h2>Extrato</h2>
      {c?.hist.length ? <div className="box" style={{ padding: '4px 14px' }}>{c.hist.slice(0, 30).map((h, i) => <div key={i} className="sumline"><span>{h.txt}<div className="hint">{quando(h.t)}</div></span><span style={{ color: h.v > 0 ? 'var(--ok)' : 'var(--muted)' }}>{h.v > 0 ? '+' : ''}{h.v || ''}</span></div>)}</div>
        : <div className="empty">Você ainda não ganhou celus. Reserve, avalie ou marque o semáforo para começar.</div>}
    </>
  );
}

export function EditarPerfil() {
  const u = useUsuario()!;
  const nav = useNavigate();
  const [foto, setFoto] = useState<string | undefined>(u.foto);
  const [bio, setBio] = useState(u.bio ?? '');
  return (
    <>
      <Voltar para="/perfil" />
      <h1>Seu perfil</h1>
      <p className="lead">Na Celus a foto do perfil é sempre o seu rosto. É ela que quem recebe você usa para saber que é você na chegada, junto com o código.</p>
      <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
        <span className="avatar grande">{foto ? <img src={foto} alt="Sua foto" /> : u.nome.slice(0, 1)}</span>
        <div className="stack" style={{ gap: 8 }}>
          <label className="btn sm ghost">{foto ? 'Tirar nova selfie' : 'Tirar selfie'}<input id="p-foto" type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFoto(await lerImagem(f, 480)); }} /></label>
          <span className="hint">Rosto de frente, sem óculos escuros, boné ou filtro. Logos, paisagens e fotos de outras pessoas não são aceitos.</span>
        </div>
      </div>
      <label className="campo" style={{ marginTop: 18 }}>Bio<textarea id="p-bio" rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ex.: Designer, moro no Centro, uso a Celus entre reuniões." /><span className="hint">{bio.length}/160</span></label>
      <button className="btn" style={{ marginTop: 16 }} disabled={!foto} onClick={() => { const g = atualizarPerfil({ foto, bio }); toast(g ? `Perfil completo. +${g} celus` : 'Perfil atualizado'); nav('/perfil'); }}>Salvar</button>
    </>
  );
}

export function ExcluirConta() {
  const nav = useNavigate();
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  return (
    <>
      <Voltar para="/perfil" />
      <h1>Excluir minha conta</h1>
      <p className="lead">Isso não pode ser desfeito.</p>
      <div className="box infos" style={{ marginTop: 0 }}>
        <div className="sumline"><span>Apagamos</span><span>Perfil, foto, bio, celus, sonhos, stories, mensagens e notificações</span></div>
        <div className="sumline"><span>Pausamos</span><span>Seus anúncios, que saem do mapa</span></div>
        <div className="sumline"><span>Guardamos sem seu nome</span><span>Registros de pagamento e avaliações, pelo prazo que a lei exige</span></div>
      </div>
      <label className="campo" style={{ marginTop: 18 }}>Sua senha<input id="x-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></label>
      <label className="campo" style={{ marginTop: 12 }}>Para confirmar, digite EXCLUIR<input id="x-conf" value={conf} onChange={(e) => setConf(e.target.value.toUpperCase())} /></label>
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
      <button className="btn" style={{ marginTop: 16, background: 'var(--bad)' }} disabled={conf !== 'EXCLUIR' || !senha} onClick={async () => { const r = await excluirConta(senha); if (r.ok) { toast('Conta excluída'); nav('/entrar'); } else setErro(r.erro); }}>Excluir conta</button>
    </>
  );
}
