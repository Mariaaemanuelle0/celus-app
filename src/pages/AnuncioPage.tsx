import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS, COMODIDADES, PROFISSOES } from '../data/catalogo';
import type { Extra } from '../data/types';
import { Miniatura, Moeda, Voltar, toast, useLocalizacao } from '../components/ui';
import { StoryRing } from '../components/Stories';
import { brl, rotuloHoras, virgula } from '../lib/format';
import { distanciaKm, formatarDistancia } from '../lib/geo';
import { SLOTS, TAXA_HORA, TAXA_SERVICO, slotDe } from '../lib/regras';
import { COR_CSS, leitura } from '../lib/semaforo';
import {
  alternarSonho, chamarProfissional, checkin, hhmm, podePostar, reservarDiaria, reservarHora, resgatar, storiesVisiveis,
} from '../store/acoes';
import { carteiraDe, useDB } from '../store/db';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hojeInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function AnuncioPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const onde = useLocalizacao();
  const a = useDB((d) => d.anuncios.find((x) => x.id === id));
  const uid = useDB((d) => d.sessao)!;
  const sonhos = useDB((d) => d.sonhos);
  const stories = useDB((d) => d.stories);
  const marcas = useDB((d) => d.semaforo);
  const beneficios = useDB((d) => d.beneficios);
  const carteira = useDB((d) => carteiraDe(d, uid).saldo);
  useDB((d) => d.checkins.length + d.reservas.length); // re-renderiza quando muda o direito de postar

  const [pacoteI, setPacoteI] = useState(0);
  const [pessoas, setPessoas] = useState(1);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [quando, setQuando] = useState<'agora' | 'depois'>('agora');
  const [dataHora, setDataHora] = useState('');
  const [checkinData, setCheckinData] = useState(hojeInput());
  const [noites, setNoites] = useState(1);
  const [horas, setHoras] = useState(2);
  const [erro, setErro] = useState('');

  const denuncias = useDB((d) => d.denuncias);
  const meusStories = useMemo(() => storiesVisiveis(stories.filter((s) => s.anuncioId === id), denuncias).sort((x, y) => x.criado - y.criado), [stories, denuncias, id]);
  if (!a) return <div className="empty">Anúncio não encontrado.</div>;

  const cat = CATEGORIAS[a.categoria];
  const sub = a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] : cat.subs[a.subcategoria];
  const servico = a.categoria === 'servicos';
  const imovel = a.categoria === 'imoveis';
  const salvo = sonhos.some((s) => s.userId === uid && s.anuncioId === a.id);
  const somaExtras = extras.reduce((s, e) => s + e.preco, 0);
  const pacote = a.pacotes?.[pacoteI];
  const pes = a.porPessoa ? pessoas : 1;
  const beneficiosAqui = beneficios.filter((b) => b.anuncioId === a.id);
  const dist = onde ? distanciaKm(onde, a) : null;

  const alternarExtra = (e: Extra) => setExtras(extras.some((x) => x.nome === e.nome) ? extras.filter((x) => x.nome !== e.nome) : [...extras, e]);

  function reservar() {
    setErro('');
    if (a!.tipoPreco === 'pacote' && pacote) {
      const inicio = quando === 'agora' ? Date.now() : Date.parse(dataHora);
      if (!inicio || Number.isNaN(inicio)) return setErro('Escolha a data e a hora.');
      if (inicio < Date.now() - 5 * 60_000) return setErro('Escolha um horário a partir de agora.');
      const r = reservarHora(a!, pacote, pes, extras, inicio);
      if (!r.ok) return setErro(r.erro);
      toast('Reserva confirmada');
      nav(`/reserva/${r.id}`);
    } else if (a!.tipoPreco === 'diaria') {
      const [y, m, d] = checkinData.split('-').map(Number);
      const inicio = new Date(y, m - 1, d, 14, 0).getTime();
      const r = reservarDiaria(a!, inicio, noites, pessoas, extras);
      if (!r.ok) return setErro(r.erro);
      toast('Reserva confirmada');
      nav(`/reserva/${r.id}`);
    }
  }

  return (
    <>
      <Voltar />
      <div style={{ position: 'relative' }}>
        <Miniatura a={a} grande />
        <button className="coracao" aria-pressed={salvo} aria-label={salvo ? 'Tirar do livro dos sonhos' : 'Guardar no livro dos sonhos'} onClick={() => { alternarSonho(a.id); toast(salvo ? 'Saiu do livro dos sonhos' : 'Guardado no livro dos sonhos'); }}>
          <svg viewBox="0 0 24 24" fill={salvo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
        </button>
      </div>

      {!servico && !imovel && (
        <div className="box" style={{ marginTop: 12, padding: '12px 14px' }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {meusStories.length > 0 && <StoryRing lista={meusStories} rotulo={`${meusStories.length} agora`} cor={cat.cor} />}
            <div className="sp" style={{ minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{meusStories.length ? 'Stories de quem está aqui' : 'Ninguém postou daqui ainda'}</b>
              <div className="hint">Ficam 3 horas no local e no perfil de quem postou.</div>
              <div className="row" style={{ marginTop: 8 }}>
                {podePostar(a.id)
                  ? <Link className="btn sm" to={`/story/${a.id}`}>Postar story daqui</Link>
                  : <button className="btn sm ghost" onClick={() => { const r = checkin(a, onde); toast(r.ok ? 'Check-in feito' : r.erro); }}>Estou aqui</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="eyebrow" style={{ marginTop: 16 }}>{cat.nome} · {sub} · {a.bairro}{dist != null ? ` · ${formatarDistancia(dist)}` : ''}</div>
      <h1>{a.titulo}</h1>
      <p style={{ margin: '0 0 14px' }}>{a.descricao}</p>

      <div className="stats">
        <div className="box stat"><b>{virgula(a.notaQualidade)}</b><span>Qualidade</span></div>
        <div className="box stat"><b>{virgula(a.notaCustoBeneficio)}</b><span>Custo-benefício</span></div>
        <div className="box stat"><b>{a.metragemM2 ?? '–'}</b><span>m²</span></div>
        <div className="box stat"><b>{a.totalSonhos}</b><span>sonham</span></div>
      </div>

      {!servico && (
        <>
          <h2>O que tem aqui</h2>
          <div className="chips">{Object.entries(COMODIDADES).map(([k, n]) => <span key={k} className={`tag ${a.comodidades.includes(k) ? '' : 'off'}`}>{n}</span>)}</div>
          <p className="meta" style={{ marginTop: 10 }}>
            {a.totalAvaliacoes} avaliações · até {a.capacidade} {a.capacidade > 1 ? 'pessoas' : 'pessoa'}
            {a.tipoAcesso ? ` · Acesso: ${ACESSO[a.tipoAcesso]}` : ''}{a.limpezaInclusa ? ' · Limpeza inclusa' : ''}
          </p>
          {a.tipoPreco === 'pacote' && (
            <p className="meta">Funcionamento: {a.agenda.dias.map((h, i) => h ? `${DIAS[i]} ${hhmm(h[0])}–${hhmm(h[1])}` : `${DIAS[i]} fechado`).filter((_, i, arr) => arr.indexOf(arr[i]) === i).join(' · ')}</p>
          )}
        </>
      )}

      {beneficiosAqui.length > 0 && (
        <>
          <h2>Troque seus celus aqui</h2>
          <div className="stack">{beneficiosAqui.map((b) => (
            <div key={b.id} className="box linha">
              <div className="sp"><b>{b.nome}</b><div className="hint">Oferecido pelo local · você tem <span className="num">{carteira}</span> celus</div></div>
              <button className="btn sm" disabled={carteira < b.custo} onClick={() => { const c = resgatar(b.id); toast(c ? `${b.nome} resgatado. Código ${c}` : 'Saldo insuficiente'); }}><Moeda tamanho={14} /> <span className="num">{b.custo}</span></button>
            </div>
          ))}</div>
        </>
      )}

      {!servico && !imovel && <SemaforoLocal a={a} marcas={marcas} />}

      <h2>{servico ? 'Como trabalha' : 'Manual de bons modos'}</h2>
      <div className="manual">{a.manualBonsModos}</div>

      {/* ---------- Reserva ---------- */}
      {a.tipoPreco === 'pacote' && a.pacotes && (
        <>
          <h2>Quanto tempo?</h2>
          <div className="pkgs">{a.pacotes.map((p, i) => (
            <button key={i} className="pkg" aria-pressed={pacoteI === i} onClick={() => setPacoteI(i)}><b>{rotuloHoras(p.horas)}</b><span className="coin">{brl(p.preco)}</span></button>
          ))}</div>
          <div className="seg" style={{ marginTop: 12 }}>
            <button aria-pressed={quando === 'agora'} onClick={() => setQuando('agora')}>Agora</button>
            <button aria-pressed={quando === 'depois'} onClick={() => setQuando('depois')}>Agendar</button>
          </div>
          {quando === 'depois' && <input id="r-quando" className="input" style={{ marginTop: 8 }} type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />}
          {a.porPessoa && a.capacidade > 1 && (
            <label className="campo" style={{ marginTop: 12 }}>Pessoas (máx. {a.capacidade})
              <select id="r-pessoas" value={pessoas} onChange={(e) => setPessoas(Number(e.target.value))}>{Array.from({ length: Math.min(a.capacidade, 20) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
            </label>
          )}
        </>
      )}

      {a.tipoPreco === 'diaria' && (
        <>
          <h2>Sua estadia</h2>
          <div className="grid2">
            <label className="campo">Check-in<input id="r-checkin" type="date" min={hojeInput()} value={checkinData} onChange={(e) => setCheckinData(e.target.value)} /></label>
            <label className="campo">Diárias<select id="r-noites" value={noites} onChange={(e) => setNoites(Number(e.target.value))}>{[1, 2, 3, 4, 5, 7, 10, 14].map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <label className="campo" style={{ marginTop: 10 }}>Hóspedes (máx. {a.capacidade})
            <select id="r-hospedes" value={pessoas} onChange={(e) => setPessoas(Number(e.target.value))}>{Array.from({ length: a.capacidade }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          </label>
        </>
      )}

      {a.extras.length > 0 && !servico && (
        <>
          <h2>Extras do anfitrião</h2>
          <div className="box">{a.extras.map((e) => (
            <label key={e.nome} className="extra"><input type="checkbox" checked={extras.some((x) => x.nome === e.nome)} onChange={() => alternarExtra(e)} /><span className="sp">{e.nome}</span><span className="coin">+ {brl(e.preco)}</span></label>
          ))}</div>
        </>
      )}

      {(a.tipoPreco === 'pacote' || a.tipoPreco === 'diaria') && (
        <div className="box resumo">
          {a.tipoPreco === 'pacote' && pacote && <div className="sumline"><span>Pacote {rotuloHoras(pacote.horas)}{pes > 1 ? ` × ${pes}` : ''}</span><span>{brl(pacote.preco * pes)}</span></div>}
          {a.tipoPreco === 'diaria' && <div className="sumline"><span>{noites} diária{noites > 1 ? 's' : ''} × {brl(a.preco ?? 0)}</span><span>{brl((a.preco ?? 0) * noites)}</span></div>}
          {extras.map((e) => <div key={e.nome} className="sumline"><span>{e.nome}</span><span>{brl(e.preco)}</span></div>)}
          {a.tipoPreco === 'pacote' && <div className="sumline"><span>Taxa de serviço</span><span>{brl(TAXA_HORA)}</span></div>}
          <div className="sumline"><span>Total</span><span>{brl((a.tipoPreco === 'pacote' && pacote ? pacote.preco * pes + TAXA_HORA : (a.preco ?? 0) * noites) + somaExtras)}</span></div>
        </div>
      )}

      {servico && (
        <>
          <div className="alerta ok" style={{ marginTop: 18 }}><b>Disponível agora</b>{dist != null ? ` a ${formatarDistancia(dist)} de você` : ''}. Freelancer: fica no máximo 12 h seguidas disponível e depois faz pausa de 6 h.</div>
          {a.unidadePreco === '/h' && (
            <label className="campo" style={{ marginTop: 12 }}>Por quantas horas?
              <select id="r-horas" value={horas} onChange={(e) => setHoras(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n}>{n}</option>)}</select>
            </label>
          )}
          <div className="box resumo">
            <div className="sumline"><span>{a.unidadePreco === '/h' ? `${horas} h × ${brl(a.preco ?? 0)}` : `1 ${(a.unidadePreco ?? '').replace('/', '')}`}</span><span>{brl((a.preco ?? 0) * (a.unidadePreco === '/h' ? horas : 1))}</span></div>
            <div className="sumline"><span>Taxa de serviço</span><span>{brl(TAXA_SERVICO)}</span></div>
            <div className="sumline"><span>Total</span><span>{brl((a.preco ?? 0) * (a.unidadePreco === '/h' ? horas : 1) + TAXA_SERVICO)}</span></div>
          </div>
        </>
      )}

      {erro && <p className="erro" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
      <div style={{ marginTop: 16 }}>
        {(a.tipoPreco === 'pacote' || a.tipoPreco === 'diaria') && a.donoId !== uid && <button className="btn" onClick={reservar}>Confirmar e pagar</button>}
        {servico && <button className="btn" onClick={() => { const rid = chamarProfissional(a, a.unidadePreco === '/h' ? horas : 1); if (rid) nav(`/reserva/${rid}`); }}>Chamar {a.titulo.split(',')[0]}</button>}
        {imovel && <button className="btn" onClick={() => toast('Interesse enviado. O corretor responsável entra em contato pela plataforma.')}>Tenho interesse</button>}
        {a.donoId === uid && <p className="hint">Este anúncio é seu.</p>}
        {(a.tipoPreco === 'pacote' || servico) && <p className="hint" style={{ marginTop: 8 }}>Pagamento em modo de teste: nenhuma cobrança real é feita.</p>}
      </div>
    </>
  );
}

function SemaforoLocal({ a, marcas }: { a: { lat: number; lng: number }; marcas: Parameters<typeof leitura>[2] }) {
  const agora = slotDe();
  return (
    <>
      <h2>Semáforo de segurança da região</h2>
      <div className="slots">{Object.entries(SLOTS).map(([k, n]) => {
        const l = leitura(a, k, marcas);
        return (
          <div key={k} className={`slot ${k === agora ? 'now' : ''}`}>
            <span className="hint">{n}{k === agora ? ' · agora' : ''}</span>
            <b style={{ color: l.cor === 'sem' ? 'var(--muted)' : COR_CSS[l.cor] }}>{l.rotulo}</b>
            <span className="hint num">{l.n} marcações</span>
            <i className="bar" style={{ background: COR_CSS[l.cor] }} />
          </div>
        );
      })}</div>
      <p className="hint" style={{ marginTop: 8 }}>Cores marcadas por quem esteve na região nos últimos 30 dias. É percepção, não garantia.</p>
    </>
  );
}
