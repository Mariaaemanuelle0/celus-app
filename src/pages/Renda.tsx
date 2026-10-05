import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS, COMODIDADES, ORDEM_CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Agenda, Anuncio, Categoria, Extra, Pacote } from '../data/types';
import { agendaPadrao } from '../data/seed';
import { Estrelas, Miniatura, Voltar, lerImagem, toast, useLocalizacao } from '../components/ui';
import { brl, rotuloPreco } from '../lib/format';
import { centroPiloto } from '../lib/geo';
import { COMISSAO, parteAnfitriao } from '../lib/regras';
import {
  avaliarHospede, criarAnuncio, criarBeneficio, decidirAnuncio, decidirDenuncia, denunciarStory, hhmm, pausarAnuncio, salvarAgenda, storiesAtivos,
} from '../store/acoes';
import { useDB, useUsuario } from '../store/db';

const STATUS_AN: Record<string, string> = { pendente: 'Aguardando aprovação', aprovado: 'No mapa', recusado: 'Recusado', pausado: 'Pausado' };

/* ---------------- Painel ---------------- */
export function Painel() {
  const u = useUsuario()!;
  const anuncios = useDB((d) => d.anuncios);
  const reservas = useDB((d) => d.reservas);
  const usuarios = useDB((d) => d.usuarios);
  const stories = useDB((d) => d.stories);
  const denuncias = useDB((d) => d.denuncias);
  const beneficios = useDB((d) => d.beneficios);
  const [benef, setBenef] = useState({ anuncioId: '', nome: '', custo: 30 });
  const [denunciar, setDenunciar] = useState<string | null>(null);

  const meus = anuncios.filter((a) => a.donoId === u.id);
  const recebidas = reservas.filter((r) => meus.some((a) => a.id === r.anuncioId));
  const concluidas = recebidas.filter((r) => r.status === 'concluida');
  const ganhos = concluidas.reduce((s, r) => s + parteAnfitriao(r), 0);
  const storiesMeus = storiesAtivos(stories).filter((s) => meus.some((a) => a.id === s.anuncioId)) as typeof stories;
  const nota = (id: string) => anuncios.find((a) => a.id === id);

  if (!meus.length) return (
    <>
      <h1>Seu espaço ou serviço trabalhando por você</h1>
      <p className="lead">Uma varanda, uma sala, uma vaga, um banheiro com chuveiro ou o seu serviço. Você define preço, horários e extras.</p>
      <ol className="etapas">
        <li><b>Cadastre</b><span>Fotos, preço por pacote e o manual de bons modos. Leva poucos minutos.</span></li>
        <li><b>A equipe Celus revisa</b><span>Conferimos tudo antes de aparecer no mapa.</span></li>
        <li><b>Receba 85% de cada reserva</b><span>A Celus fica com 15%. Quem reserva paga uma taxa à parte.</span></li>
      </ol>
      <Link className="btn" to="/renda/anunciar">Anunciar agora</Link>
    </>
  );

  return (
    <>
      <h1>Seu painel</h1>
      <div className="kpis">
        <div className="box kpi"><b className="num">{brl(ganhos)}</b><span>a receber</span></div>
        <div className="box kpi"><b className="num">{recebidas.length}</b><span>reservas</span></div>
        <div className="box kpi"><b className="num">{meus.reduce((s, a) => s + a.totalSonhos, 0)}</b><span>sonham</span></div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Valor já descontada a comissão de {Math.round(COMISSAO * 100)}%. Repasse D+1 depois do uso; estadias, 24 h após o check-in.</p>

      <h2>Meus anúncios</h2>
      <div className="stack">{meus.map((a) => (
        <div key={a.id} className="box listrow">
          <Miniatura a={a} />
          <div><span className="t">{a.titulo}</span><span className="meta">{rotuloPreco(a)} · {a.extras.length} extras</span>
            <span className={`status ${a.status}`}>{STATUS_AN[a.status]}</span>
            <div className="row" style={{ marginTop: 4 }}>
              {a.tipoPreco !== 'valor' && a.categoria !== 'servicos' && <Link className="btn sm ghost" to={`/renda/agenda/${a.id}`}>Agenda</Link>}
              {(a.status === 'aprovado' || a.status === 'pausado') && <button className="btn sm ghost" onClick={() => pausarAnuncio(a.id)}>{a.status === 'pausado' ? 'Reativar' : 'Pausar'}</button>}
            </div>
          </div>
        </div>
      ))}</div>
      <Link className="btn" style={{ marginTop: 14, display: 'block', textAlign: 'center', textDecoration: 'none' }} to="/renda/anunciar">Anunciar outro</Link>

      <h2>Reservas recebidas</h2>
      {recebidas.length ? <div className="stack">{recebidas.map((r) => {
        const a = nota(r.anuncioId)!;
        return (
          <div key={r.id} className="box" style={{ padding: 14 }}>
            <div className="row"><b className="sp">{usuarios[r.userId]?.nome ?? 'Hóspede'}</b><span className="coin">{brl(parteAnfitriao(r))}</span></div>
            <div className="meta">{a.titulo} · {new Date(r.inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {r.status === 'concluida' ? 'Concluída' : r.status === 'cancelada' ? 'Cancelada' : 'Ativa'}</div>
            {r.status === 'concluida' && !r.avaliadaPeloAnfitriao && (
              <div style={{ marginTop: 8 }}><div className="hint">Avalie o hóspede (só estrelas):</div><Estrelas valor={0} onChange={(n) => { avaliarHospede(r.id, n); toast('Avaliação enviada'); }} rotulo="Nota do hóspede" /></div>
            )}
          </div>
        );
      })}</div> : <div className="empty">Ainda sem reservas. Elas aparecem aqui assim que alguém reservar.</div>}

      <h2>Benefícios que você oferece</h2>
      <p className="hint" style={{ margin: '-6px 0 10px' }}>Brindes ou descontos que as pessoas trocam por celus no seu espaço. Você define e você custeia; em troca, seu espaço aparece para quem junta celus.</p>
      <div className="stack">
        {beneficios.filter((b) => meus.some((a) => a.id === b.anuncioId)).map((b) => <div key={b.id} className="box linha"><div className="sp"><b>{b.nome}</b><div className="hint">{b.desc}</div></div><span className="coin">{b.custo} celus</span></div>)}
        <form className="box" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }} onSubmit={(e) => { e.preventDefault(); const lid = benef.anuncioId || meus[0].id; if (!benef.nome.trim()) return toast('Escreva o benefício'); criarBeneficio(lid, benef.nome.trim(), benef.custo); setBenef({ ...benef, nome: '' }); toast('Benefício publicado'); }}>
          <select style={{ gridColumn: '1 / -1' }} value={benef.anuncioId} onChange={(e) => setBenef({ ...benef, anuncioId: e.target.value })} aria-label="Espaço">{meus.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}</select>
          <input placeholder="Ex.: água de coco de brinde" value={benef.nome} onChange={(e) => setBenef({ ...benef, nome: e.target.value })} aria-label="Benefício" />
          <input type="number" min={5} value={benef.custo} onChange={(e) => setBenef({ ...benef, custo: Number(e.target.value) })} aria-label="Custo em celus" />
          <button className="btn sm" style={{ gridColumn: '1 / -1' }}>Adicionar benefício</button>
        </form>
      </div>

      <h2>Stories no seu espaço</h2>
      {storiesMeus.length ? <div className="stack">{storiesMeus.map((s) => {
        const ja = denuncias.some((d) => d.storyId === s.id);
        return (
          <div key={s.id} className="box" style={{ padding: 14 }}>
            <div className="row"><b className="sp">{s.autorNome}</b>{ja ? <span className="status pendente">Em análise</span> : <button className="btn sm ghost" onClick={() => setDenunciar(denunciar === s.id ? null : s.id)}>Denunciar</button>}</div>
            <div className="meta">{s.legenda || 'Sem legenda'} · {nota(s.anuncioId)?.titulo}</div>
            {denunciar === s.id && <div className="stack" style={{ gap: 6, marginTop: 8 }}>{['Mostra pessoa sem autorização', 'Aparece criança', 'Conteúdo impróprio', 'Não foi feito neste local'].map((m) => <button key={m} className="btn sm ghost" style={{ textAlign: 'left' }} onClick={() => { denunciarStory(s.id, 'Anfitrião', m); setDenunciar(null); toast('Denúncia enviada. A curadoria Celus decide.'); }}>{m}</button>)}</div>}
          </div>
        );
      })}</div> : <div className="empty">Nenhum story no ar nos seus espaços agora.</div>}
      <p className="hint" style={{ marginTop: 8 }}>Você não pode apagar o story de um cliente, nem quando ele critica. Se algo quebrar as regras, denuncie e a curadoria Celus decide.</p>
    </>
  );
}

/* ---------------- Anunciar ---------------- */
type Rascunho = {
  cat: Categoria; sub: string; prof: string; titulo: string; bairro: string; descricao: string;
  pacotes: Pacote[]; preco: number; unidade: string; porPessoa: boolean; metragem: number; capacidade: number;
  comodidades: string[]; extras: Extra[]; acesso: NonNullable<Anuncio['tipoAcesso']>; responsavel: string; manual: string; limpeza: boolean; fotos: string[];
};
const RASCUNHO: Rascunho = {
  cat: 'descanso', sub: 'rede', prof: '', titulo: '', bairro: '', descricao: '',
  pacotes: [{ horas: 1, preco: 10 }, { horas: 3, preco: 25 }, { horas: 6, preco: 45 }], preco: 100, unidade: '/h', porPessoa: false, metragem: 10, capacidade: 1,
  comodidades: [], extras: [], acesso: 'responsavel', responsavel: '', manual: '', limpeza: false, fotos: [],
};
const tipoPrecoDe = (c: Categoria): Anuncio['tipoPreco'] => (c === 'ficar' ? 'diaria' : c === 'imoveis' ? 'valor' : c === 'servicos' ? 'servico' : 'pacote');

export function Anunciar() {
  const nav = useNavigate();
  const onde = useLocalizacao();
  const [f, setF] = useState<Rascunho>(RASCUNHO);
  const [erro, setErro] = useState('');
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setF((x) => ({ ...x, [k]: v }));
  const tipo = tipoPrecoDe(f.cat);
  const servico = f.cat === 'servicos';

  function escolherCat(c: Categoria) {
    const sub = Object.keys(CATEGORIAS[c].subs)[0];
    setF((x) => ({ ...x, cat: c, sub, prof: c === 'servicos' ? Object.keys(PROFISSOES[sub])[0] : '', unidade: c === 'servicos' ? '/h' : c === 'imoveis' ? '/mês' : '' }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault(); setErro('');
    if (f.titulo.trim().length < 4) return setErro('Dê um título ao anúncio.');
    if (!f.fotos.length) return setErro('Adicione pelo menos uma foto.');
    if (tipo === 'pacote' && !f.pacotes.some((p) => p.preco > 0)) return setErro('Defina o preço de pelo menos um pacote.');
    if (tipo !== 'pacote' && !(f.preco > 0)) return setErro('Defina o preço.');
    if (!f.manual.trim()) return setErro(servico ? 'Conte como você trabalha.' : 'Escreva o manual de bons modos.');
    const p = onde ?? centroPiloto();
    const id = criarAnuncio({
      categoria: f.cat, subcategoria: f.sub, profissao: servico ? f.prof : undefined, titulo: f.titulo.trim(), descricao: f.descricao.trim(), bairro: f.bairro.trim(),
      lat: p.lat, lng: p.lng, tipoPreco: tipo, pacotes: tipo === 'pacote' ? f.pacotes.filter((x) => x.preco > 0).sort((a, b) => a.horas - b.horas) : undefined,
      preco: tipo === 'pacote' ? undefined : f.preco, unidadePreco: tipo === 'servico' || tipo === 'valor' ? f.unidade : undefined, porPessoa: f.porPessoa,
      capacidade: servico ? 1 : f.capacidade, metragemM2: servico ? undefined : f.metragem, comodidades: servico ? [] : f.comodidades,
      extras: f.extras.filter((x) => x.nome.trim()), tipoAcesso: servico ? undefined : f.acesso, responsavelLocal: f.responsavel || undefined,
      manualBonsModos: f.manual.trim(), limpezaInclusa: f.limpeza, fotos: f.fotos, agenda: agendaPadrao(tipo),
    });
    if (id) { toast('Enviado para a curadoria'); nav('/renda'); }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h1>Anunciar</h1>
      <p className="lead">O anúncio fica na posição onde você está agora{onde ? '' : ' (sem localização: usamos o centro da cidade piloto)'}. A equipe Celus revisa antes de publicar.</p>
      <div className="stack">
        <div><div className="flabel">Categoria</div><div className="cats">{ORDEM_CATEGORIAS.map((k) => <button type="button" key={k} className="cat" style={{ ['--c' as string]: CATEGORIAS[k].cor }} aria-pressed={f.cat === k} onClick={() => escolherCat(k)}><i />{CATEGORIAS[k].curto ?? CATEGORIAS[k].nome}</button>)}</div></div>
        <div><div className="flabel">{servico ? 'Nicho' : 'Tipo'}</div><div className="chips">{Object.entries(CATEGORIAS[f.cat].subs).map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.sub === k} onClick={() => setF((x) => ({ ...x, sub: k, prof: servico ? Object.keys(PROFISSOES[k])[0] : '' }))}>{n}</button>)}</div></div>
        {servico && <div><div className="flabel">Profissão</div><div className="chips">{Object.entries(PROFISSOES[f.sub]).map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.prof === k} onClick={() => set('prof', k)}>{n}</button>)}</div></div>}
        <label className="campo">{servico ? 'Seu nome e profissão' : 'Título'}<input id="a-titulo" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={servico ? 'Ex.: Ana, eletricista' : 'Ex.: Varanda com rede e ducha'} /></label>
        <label className="campo">Bairro<input id="a-bairro" value={f.bairro} onChange={(e) => set('bairro', e.target.value)} /></label>
        <label className="campo">Descrição<textarea id="a-desc" rows={3} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></label>
        <div><div className="flabel">Fotos <span className="hint">mínimo 1, ideal 3 ou mais</span></div>
          <div className="uploads">{f.fotos.map((s, i) => <img key={i} src={s} alt="" />)}<label className="addfoto">+<input id="a-fotos" type="file" accept="image/*" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 6); const lidas = await Promise.all(fs.map(lerImagem)); set('fotos', [...f.fotos, ...lidas].slice(0, 8)); }} /></label></div></div>

        {tipo === 'pacote' && (
          <div><div className="flabel">Pacotes de tempo <span className="hint">horas e preço; dê desconto nos maiores</span></div>
            <div className="pkgs">{f.pacotes.map((p, i) => (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <input type="number" min={0.25} step={0.25} value={p.horas} aria-label={`Horas do pacote ${i + 1}`} onChange={(e) => set('pacotes', f.pacotes.map((x, j) => j === i ? { ...x, horas: Number(e.target.value) } : x))} />
                <input type="number" min={0} value={p.preco} aria-label={`Preço do pacote ${i + 1}`} onChange={(e) => set('pacotes', f.pacotes.map((x, j) => j === i ? { ...x, preco: Number(e.target.value) } : x))} />
              </div>
            ))}</div>
            <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={f.porPessoa} onChange={(e) => set('porPessoa', e.target.checked)} /><span>Cobrar por pessoa (espaço compartilhado)</span></label>
          </div>
        )}
        {tipo !== 'pacote' && (
          <div className="grid2">
            <label className="campo">{tipo === 'diaria' ? 'Diária (R$)' : 'Preço (R$)'}<input type="number" min={1} value={f.preco} onChange={(e) => set('preco', Number(e.target.value))} /></label>
            {tipo !== 'diaria' && <label className="campo">Cobrado por<select value={f.unidade} onChange={(e) => set('unidade', e.target.value)}>{(servico ? ['/h', '/visita', '/dia', '/atendimento', '/passeio'] : ['/mês', '']).map((u) => <option key={u} value={u}>{u ? u.slice(1) : 'venda'}</option>)}</select></label>}
          </div>
        )}

        {!servico && (
          <>
            <div className="grid2">
              <label className="campo">Metragem (m²)<input type="number" min={1} value={f.metragem} onChange={(e) => set('metragem', Number(e.target.value))} /></label>
              <label className="campo">Capacidade<input type="number" min={1} value={f.capacidade} onChange={(e) => set('capacidade', Number(e.target.value))} /></label>
            </div>
            <div><div className="flabel">O que tem no local</div><div className="checks">{Object.entries(COMODIDADES).map(([k, n]) => <label key={k} className="check"><input type="checkbox" checked={f.comodidades.includes(k)} onChange={() => set('comodidades', f.comodidades.includes(k) ? f.comodidades.filter((x) => x !== k) : [...f.comodidades, k])} /><span>{n}</span></label>)}</div>
              <p className="hint">Comodidade é o que vem junto. Para alugar o banheiro separado, crie outro anúncio na categoria Banheiro.</p></div>
            <div><div className="flabel">Extras que você oferece</div>
              <div className="stack" style={{ gap: 6 }}>{f.extras.map((x, i) => (
                <div key={i} className="exrow"><input value={x.nome} placeholder="Item" aria-label="Nome do extra" onChange={(e) => set('extras', f.extras.map((y, j) => j === i ? { ...y, nome: e.target.value } : y))} />
                  <input type="number" min={0} value={x.preco} aria-label="Preço do extra" onChange={(e) => set('extras', f.extras.map((y, j) => j === i ? { ...y, preco: Number(e.target.value) } : y))} />
                  <button type="button" aria-label="Remover extra" onClick={() => set('extras', f.extras.filter((_, j) => j !== i))}>×</button></div>
              ))}<button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set('extras', [...f.extras, { nome: '', preco: 0 }])}>+ Adicionar extra</button></div></div>
            <label className="campo">Como a pessoa entra<select value={f.acesso} onChange={(e) => set('acesso', e.target.value as Rascunho['acesso'])}>{Object.entries(ACESSO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            {f.acesso === 'responsavel' && <label className="campo">Responsável local (nome e contato)<input value={f.responsavel} onChange={(e) => set('responsavel', e.target.value)} placeholder="Ex.: Ana, vizinha da casa 3" /></label>}
            <label className="check"><input type="checkbox" checked={f.limpeza} onChange={(e) => set('limpeza', e.target.checked)} /><span>Tenho limpeza depois de cada uso</span></label>
          </>
        )}
        <label className="campo">{servico ? 'Como você trabalha' : 'Manual de bons modos'}<textarea rows={3} value={f.manual} onChange={(e) => set('manual', e.target.value)} /></label>
        {servico ? <div className="dica"><p style={{ margin: 0 }}>Você trabalha como freelancer. Depois de 12 h seguidas disponível, seu perfil pausa por 6 h. A comissão da Celus é de 15% por chamado e você emite nota sobre o que ganhar.</p></div>
          : <div className="dica"><p style={{ margin: 0 }}>Regra da casa: nenhum espaço pode deixar duas pessoas desconhecidas sozinhas num ambiente íntimo fechado. Prefira acesso independente. Comissão Celus: 15% por reserva.</p></div>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn">Enviar para aprovação</button>
      </div>
    </form>
  );
}

/* ---------------- Agenda ---------------- */
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const paraMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

export function AgendaPage() {
  const { id } = useParams();
  const a = useDB((d) => d.anuncios.find((x) => x.id === id));
  const [ag, setAg] = useState<Agenda | null>(a ? structuredClone(a.agenda) : null);
  const [nova, setNova] = useState('');
  if (!a || !ag) return <div className="empty">Anúncio não encontrado.</div>;
  const porHora = a.tipoPreco === 'pacote';
  return (
    <>
      <Voltar para="/renda" />
      <div className="eyebrow">Agenda</div>
      <h1>{a.titulo}</h1>
      {porHora && (
        <>
          <h2>Horário de funcionamento</h2>
          <div className="box" style={{ padding: '4px 14px' }}>{DIAS.map((n, i) => {
            const h = ag.dias[i];
            return (
              <div key={n} className="sumline" style={{ alignItems: 'center' }}>
                <label className="check" style={{ minWidth: 110 }}><input type="checkbox" checked={!!h} onChange={(e) => setAg({ ...ag, dias: ag.dias.map((x, j) => j === i ? (e.target.checked ? [8 * 60, 22 * 60] : null) : x) })} /><span>{n}</span></label>
                {h ? <span className="row" style={{ gap: 4 }}>
                  <input type="time" value={hhmm(h[0])} onChange={(e) => setAg({ ...ag, dias: ag.dias.map((x, j) => j === i ? [paraMin(e.target.value), h[1]] : x) })} aria-label={`Abre ${n}`} />
                  <input type="time" value={hhmm(h[1] === 1440 ? 1439 : h[1])} onChange={(e) => setAg({ ...ag, dias: ag.dias.map((x, j) => j === i ? [h[0], paraMin(e.target.value)] : x) })} aria-label={`Fecha ${n}`} />
                </span> : <span className="hint">Fechado</span>}
              </div>
            );
          })}</div>
        </>
      )}
      <h2>Datas bloqueadas</h2>
      <p className="hint" style={{ margin: '-6px 0 10px' }}>Dias em que ninguém pode reservar (viagem, manutenção, uso próprio).</p>
      <div className="row"><input type="date" value={nova} onChange={(e) => setNova(e.target.value)} aria-label="Data para bloquear" /><button className="btn sm" type="button" disabled={!nova} onClick={() => { if (!ag.bloqueios.includes(nova)) setAg({ ...ag, bloqueios: [...ag.bloqueios, nova].sort() }); setNova(''); }}>Bloquear</button></div>
      <div className="chips" style={{ marginTop: 10 }}>{ag.bloqueios.map((b) => <button key={b} className="chip" onClick={() => setAg({ ...ag, bloqueios: ag.bloqueios.filter((x) => x !== b) })}>{b.split('-').reverse().join('/')} ×</button>)}{!ag.bloqueios.length && <span className="hint">Nenhuma data bloqueada.</span>}</div>
      <button className="btn" style={{ marginTop: 20 }} onClick={() => { salvarAgenda(a.id, ag); toast('Agenda salva'); }}>Salvar agenda</button>
    </>
  );
}

/* ---------------- Curadoria ---------------- */
export function Curadoria() {
  const u = useUsuario()!;
  const anuncios = useDB((d) => d.anuncios);
  const denuncias = useDB((d) => d.denuncias);
  const stories = useDB((d) => d.stories);
  if (!u.equipeCelus) return (
    <>
      <div className="eyebrow">Equipe Celus</div>
      <h1>Curadoria</h1>
      <p className="lead">Área da equipe Celus: aprova anúncios e decide denúncias. Para testar, ative "Sou da equipe Celus" no seu Perfil.</p>
      <Link className="btn ghost" to="/perfil">Ir para o Perfil</Link>
    </>
  );
  const pend = anuncios.filter((a) => a.status === 'pendente');
  return (
    <>
      <div className="eyebrow">Equipe Celus</div>
      <h1>Curadoria</h1>
      <p className="lead">Nada entra no mapa sem passar por aqui, e só a curadoria remove story de cliente.</p>
      <h2>Stories denunciados {denuncias.length ? <span className="coin">{denuncias.length}</span> : null}</h2>
      {denuncias.length ? <div className="stack">{denuncias.map((d) => {
        const s = stories.find((x) => x.id === d.storyId); const a = anuncios.find((x) => x.id === s?.anuncioId);
        if (!s) return null;
        return (
          <div key={d.id} className="box" style={{ padding: 14 }}>
            <b>{s.autorNome} em {a?.titulo}</b>
            {s.img && <img src={s.img} alt="" className="denimg" />}
            <div className="meta">"{s.legenda || 'Sem legenda'}"</div>
            <div className="hint">Por: {d.por} · {d.motivo}{d.por === 'Usuário' ? ' · oculto até decisão' : ' · segue no ar'}</div>
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { decidirDenuncia(d.id, true); toast('Story removido'); }}>Remover story</button><button className="btn sm ghost" onClick={() => { decidirDenuncia(d.id, false); toast('Story mantido no ar'); }}>Manter no ar</button></div>
          </div>
        );
      })}</div> : <div className="empty">Nenhuma denúncia pendente.</div>}
      <h2>Anúncios para aprovar {pend.length ? <span className="coin">{pend.length}</span> : null}</h2>
      {pend.length ? <div className="stack">{pend.map((a) => (
        <div key={a.id} className="box" style={{ overflow: 'hidden' }}>
          <Miniatura a={a} grande />
          <div style={{ padding: 14 }}>
            <b>{a.titulo}</b>
            <div className="meta">{CATEGORIAS[a.categoria].nome} · {rotuloPreco(a)}{a.metragemM2 ? ` · ${a.metragemM2} m²` : ''} · até {a.capacidade}</div>
            <p style={{ fontSize: 14 }}>{a.descricao}</p>
            {a.comodidades.length > 0 && <div className="chips">{a.comodidades.map((c) => <span key={c} className="tag">{COMODIDADES[c]}</span>)}</div>}
            {a.extras.length > 0 && <p className="meta">Extras: {a.extras.map((e) => `${e.nome} ${brl(e.preco)}`).join(', ')}</p>}
            <div className="manual" style={{ marginTop: 8 }}>{a.manualBonsModos}</div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => { decidirAnuncio(a.id, 'aprovado'); toast('Publicado no mapa'); }}>Aprovar</button><button className="btn sm ghost" onClick={() => { decidirAnuncio(a.id, 'recusado'); toast('Anúncio recusado'); }}>Recusar</button></div>
          </div>
        </div>
      ))}</div> : <div className="empty">Fila vazia.</div>}
    </>
  );
}
