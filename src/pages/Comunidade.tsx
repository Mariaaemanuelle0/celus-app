import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Voltar, toast, useAgora, useLocalizacao } from '../components/ui';
import { centroPiloto, distanciaKm, formatarDistancia } from '../lib/geo';
import { dataEvento } from '../lib/format';
import {
  alternarComunidade, cancelarPresenca, confirmarEncontro, criarComunidade, criarEncontro, encerrarEncontro, marcarPresenca,
} from '../store/acoes';
import { carteiraDe, useDB, useUsuario } from '../store/db';
import type { Encontro } from '../data/types';

const total = (c: { membros: string[]; membrosBase?: number }) => c.membros.length + (c.membrosBase ?? 0);

/** Lista de comunidades: as suas primeiro, depois as mais perto. */
export function Comunidades() {
  const u = useUsuario()!;
  const onde = useLocalizacao() ?? centroPiloto();
  const comunidades = useDB((d) => d.comunidades);
  const encontros = useDB((d) => d.encontros);
  const [q, setQ] = useState('');
  const termo = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = useMemo(() => comunidades
    .filter((c) => !termo || `${c.nome} ${c.atividade} ${c.bairro}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termo))
    .map((c) => ({ c, d: distanciaKm(onde, c), minha: c.membros.includes(u.id) }))
    .sort((a, b) => Number(b.minha) - Number(a.minha) || a.d - b.d), [comunidades, termo, onde, u.id]);
  const proximo = (id: string) => encontros.filter((e) => e.comunidadeId === id && !e.encerrado && e.fim > Date.now()).sort((a, b) => a.inicio - b.inicio)[0];
  return (
    <>
      <Voltar para="/perfil" />
      <h1>Comunidades</h1>
      <p className="lead">Gente que faz a mesma coisa no mesmo lugar. Chegou agora na cidade? Comece por aqui.</p>
      <div className="busca" style={{ boxShadow: 'none' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="com-busca" type="search" placeholder="Corrida, trilha, xadrez, bairro" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar comunidade" />
      </div>
      <div className="stack" style={{ marginTop: 14 }}>
        {lista.map(({ c, d, minha }) => {
          const p = proximo(c.id);
          return (
            <Link key={c.id} to={`/comunidade/${c.id}`} className="box comu">
              <span className="comu-ic" aria-hidden="true">{c.atividade.slice(0, 1)}</span>
              <span className="sp" style={{ minWidth: 0 }}>
                <b>{c.nome}</b>
                <span className="meta" style={{ display: 'block' }}>{c.atividade}, {c.bairro}, a {formatarDistancia(d)}. <span className="num">{total(c)}</span> membros</span>
                {p && <span className="hint" style={{ display: 'block', color: 'var(--accent-2)' }}>Próximo: {dataEvento(p.inicio)}</span>}
              </span>
              {minha && <span className="status aprovado">Você participa</span>}
            </Link>
          );
        })}
        {!lista.length && <div className="empty">Nenhuma comunidade com esse nome por perto. Que tal criar a primeira?</div>}
      </div>
      <Link className="btn ghost" style={{ marginTop: 16 }} to="/comunidade/nova">Criar uma comunidade</Link>
    </>
  );
}

export function NovaComunidade() {
  const nav = useNavigate();
  const onde = useLocalizacao() ?? centroPiloto();
  const [f, setF] = useState({ nome: '', atividade: '', bairro: '', descricao: '', regras: '' });
  const [erro, setErro] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Voltar para="/comunidade" />
      <h1>Nova comunidade</h1>
      <p className="lead">Um grupo de interesse com um lugar de referência. Ex.: "Corrida na Enseada".</p>
      <div className="stack">
        <label className="campo">Nome<input id="nc-nome" value={f.nome} onChange={set('nome')} placeholder="Corrida na Enseada" /></label>
        <div className="grid2">
          <label className="campo">Atividade<input id="nc-atv" value={f.atividade} onChange={set('atividade')} placeholder="Corrida" /></label>
          <label className="campo">Bairro ou lugar<input id="nc-bairro" value={f.bairro} onChange={set('bairro')} placeholder="Enseada" /></label>
        </div>
        <label className="campo">Sobre<textarea rows={3} value={f.descricao} onChange={set('descricao')} placeholder="Para quem é, nível, quando costumam se encontrar" /></label>
        <label className="campo">Combinados do grupo<textarea rows={2} value={f.regras} onChange={set('regras')} placeholder="Ex.: chegue 10 minutos antes" /></label>
        <p className="hint">A comunidade fica no lugar onde você está agora. Sem telefone ou link de grupo: tudo acontece aqui.</p>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn" onClick={() => { const r = criarComunidade({ ...f, lat: onde.lat, lng: onde.lng }); if (r.ok) { toast('Comunidade criada'); nav(`/comunidade/${r.id}`); } else setErro(r.erro); }}>Criar comunidade</button>
      </div>
    </>
  );
}

export function ComunidadePage() {
  const { id } = useParams();
  useAgora(30_000);
  const u = useUsuario()!;
  const c = useDB((d) => d.comunidades.find((x) => x.id === id));
  const encontrosTodos = useDB((d) => d.encontros);
  const usuarios = useDB((d) => d.usuarios);
  const [novo, setNovo] = useState(false);
  if (!c) return <div className="empty">Comunidade não encontrada.</div>;
  const membro = c.membros.includes(u.id);
  const encontros = encontrosTodos.filter((e) => e.comunidadeId === c.id).sort((a, b) => a.inicio - b.inicio);
  const futuros = encontros.filter((e) => !e.encerrado && e.fim > Date.now());
  const meus = c.membros.filter((m) => usuarios[m]).slice(0, 12);
  return (
    <>
      <Voltar para="/comunidade" />
      <span className="catpill" style={{ ['--c' as string]: '#5ED3E8' }}>{c.atividade}</span>
      <h1>{c.nome}</h1>
      <p className="meta" style={{ margin: '0 0 10px' }}>{c.bairro}. <span className="num">{total(c)}</span> membros</p>
      <p className="desc">{c.descricao}</p>
      {c.regras && <div className="manual">{c.regras}</div>}
      <button className={`btn ${membro ? 'ghost' : ''}`} style={{ marginTop: 14 }} onClick={() => { alternarComunidade(c.id); toast(membro ? 'Você saiu da comunidade' : 'Você entrou. Avisamos dos próximos encontros'); }}>{membro ? 'Sair da comunidade' : 'Participar'}</button>

      {meus.length > 0 && (
        <div className="membros">{meus.map((m) => <Link key={m} to={`/pessoa/${m}`} className="avatar mini" title={usuarios[m].nome}>{usuarios[m].foto ? <img src={usuarios[m].foto} alt={usuarios[m].nome} /> : usuarios[m].nome.slice(0, 1)}</Link>)}</div>
      )}

      <h2>Próximos encontros</h2>
      {futuros.length ? <div className="stack">{futuros.map((e) => <EncontroCard key={e.id} e={e} />)}</div> : <div className="empty">Nenhum encontro marcado.</div>}
      {membro && (!novo ? <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setNovo(true)}>Marcar um encontro</button> : <NovoEncontro comunidadeId={c.id} fechar={() => setNovo(false)} />)}
    </>
  );
}

function EncontroCard({ e }: { e: Encontro }) {
  const u = useUsuario()!;
  const saldo = useDB((d) => carteiraDe(d, u.id).saldo);
  const organizador = useDB((d) => d.usuarios[e.organizadorId]);
  const [cod, setCod] = useState('');
  const [confirmaCancel, setConfirmaCancel] = useState(false);
  const minha = e.presencas.find((p) => p.userId === u.id && (p.status === 'confirmado' || p.status === 'presente'));
  const confirmados = e.presencas.filter((p) => p.status === 'confirmado' || p.status === 'presente');
  const souOrg = e.organizadorId === u.id;
  const noPrazo = e.inicio - Date.now() >= e.prazoCancelH * 3600_000;
  const demo = e.organizadorId.startsWith('demo-');
  return (
    <div className="box encontro">
      <div className="hint" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{dataEvento(e.inicio)}</div>
      <b>{e.titulo}</b>
      <div className="meta">{e.local}. {organizador ? `Com ${organizador.nome.split(' ')[0]}. ` : ''}<span className="num">{confirmados.length}/{e.vagas}</span> confirmados</div>
      {e.descricao && <p className="desc" style={{ margin: '6px 0 0', fontSize: 14 }}>{e.descricao}</p>}
      {e.caucao > 0 && <p className="hint" style={{ margin: '8px 0 0' }}>Caução de <b className="num">{e.caucao}</b> celus: volta para você quando o código é conferido na chegada. Cancele até {e.prazoCancelH} h antes para não perder. Se faltar, vai para quem organiza.</p>}

      {!souOrg && !minha && (
        <button className="btn sm" style={{ marginTop: 10 }} disabled={confirmados.length >= e.vagas} onClick={() => { const r = confirmarEncontro(e.id); toast(r.ok ? (e.caucao ? `Presença confirmada. ${e.caucao} celus reservados` : 'Presença confirmada') : r.erro); }}>
          {confirmados.length >= e.vagas ? 'Vagas esgotadas' : e.caucao ? `Confirmar presença (${e.caucao} celus)` : 'Confirmar presença'}
        </button>
      )}
      {!souOrg && !minha && e.caucao > saldo && <p className="hint" style={{ margin: '6px 0 0' }}>Você tem {saldo} celus disponíveis.</p>}

      {minha && minha.status === 'confirmado' && (
        <div className="codigo-chegada" style={{ marginTop: 10 }}>
          <div className="eyebrow">Seu código de chegada</div>
          <div className="code num">{minha.codigo}</div>
          <p className="hint" style={{ margin: 0 }}>Mostre para quem organiza quando chegar.</p>
          {demo && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => { const r = marcarPresenca(e.id, minha.codigo, true); toast(r.ok ? 'Presença conferida' : r.erro); }}>Simular conferência do código</button>}
          {!confirmaCancel ? <button className="back" style={{ margin: '10px 0 0' }} onClick={() => setConfirmaCancel(true)}>Não vou mais</button>
            : <div className={`alerta ${noPrazo ? 'warn' : 'bad'}`} style={{ marginTop: 10 }}>
                {noPrazo ? (e.caucao ? `Dentro do prazo: seus ${e.caucao} celus voltam.` : 'Sua vaga fica livre para outra pessoa.') : `Fora do prazo de ${e.prazoCancelH} h: os ${e.caucao} celus vão para quem organiza.`}
                <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { const r = cancelarPresenca(e.id); toast(r.ok ? (r.perdeu ? `Presença cancelada. ${r.perdeu} celus foram para quem organiza` : 'Presença cancelada') : r.erro); }}>Cancelar presença</button><button className="btn sm ghost" onClick={() => setConfirmaCancel(false)}>Voltar</button></div>
              </div>}
        </div>
      )}
      {minha && minha.status === 'presente' && <div className="hint" style={{ marginTop: 8, color: 'var(--ok)' }}>Presença conferida.</div>}

      {souOrg && (
        <div className="conferir">
          <label className="hint" htmlFor={`enc-${e.id}`}>Você organiza. Confira o código de quem chegar:</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id={`enc-${e.id}`} className="num" inputMode="numeric" maxLength={4} placeholder="0000" value={cod} onChange={(x) => setCod(x.target.value.replace(/\D/g, ''))} />
            <button className="btn sm" disabled={cod.length !== 4} onClick={() => { const r = marcarPresenca(e.id, cod); toast(r.ok ? `${r.nome}: presença conferida` : r.erro); setCod(''); }}>Conferir</button>
          </div>
          <button className="back" style={{ margin: '6px 0 0' }} onClick={() => { encerrarEncontro(e.id); toast('Encontro encerrado. Faltas registradas'); }}>Encerrar encontro e registrar faltas</button>
        </div>
      )}
    </div>
  );
}

function NovoEncontro({ comunidadeId, fechar }: { comunidadeId: string; fechar: () => void }) {
  const [f, setF] = useState({ titulo: '', descricao: '', local: '', inicio: '', duracao: 1.5, vagas: 20, caucao: 0, prazo: 6 });
  const [erro, setErro] = useState('');
  return (
    <div className="box" style={{ padding: 14, marginTop: 12 }}>
      <div className="stack">
        <label className="campo">Título<input id="ne-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Aula experimental, treino, trilha" /></label>
        <label className="campo">Ponto de encontro<input id="ne-local" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Ex.: quiosque 4 da praia" /></label>
        <div className="grid2">
          <label className="campo">Começa<input id="ne-inicio" type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></label>
          <label className="campo">Vagas<input type="number" min={1} value={f.vagas} onChange={(e) => setF({ ...f, vagas: Number(e.target.value) })} /></label>
        </div>
        <div className="grid2">
          <label className="campo">Caução em celus<input id="ne-caucao" type="number" min={0} max={500} value={f.caucao} onChange={(e) => setF({ ...f, caucao: Number(e.target.value) })} /></label>
          <label className="campo">Cancelar até (h antes)<input type="number" min={0} max={72} value={f.prazo} onChange={(e) => setF({ ...f, prazo: Number(e.target.value) })} /></label>
        </div>
        <p className="hint" style={{ margin: 0 }}>Caução é compromisso: volta para quem vier e fica com você se a pessoa faltar ou desistir fora do prazo. Zero para encontro livre.</p>
        <label className="campo">Detalhes<textarea rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></label>
        {erro && <p className="erro">{erro}</p>}
        <div className="row"><button className="btn sm" onClick={() => { const ini = Date.parse(f.inicio); const r = criarEncontro({ comunidadeId, titulo: f.titulo, descricao: f.descricao.trim(), local: f.local.trim(), inicio: ini, fim: ini + f.duracao * 3600_000, vagas: f.vagas, caucao: f.caucao, prazoCancelH: f.prazo }); if (r.ok) { toast('Encontro marcado. Membros avisados'); fechar(); } else setErro(r.erro); }}>Marcar encontro</button><button className="btn sm ghost" onClick={fechar}>Cancelar</button></div>
      </div>
    </div>
  );
}
