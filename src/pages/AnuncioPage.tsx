import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS, COMODIDADES, PROFISSOES } from '../data/catalogo';
import type { Anuncio, Extra } from '../data/types';
import { IconeCategoria, Miniatura, Moeda, Voltar, toast, useLocalizacao } from '../components/ui';
import { StoryRing } from '../components/Stories';
import { brl, rotuloHoras, virgula } from '../lib/format';
import { distanciaKm, formatarDistancia } from '../lib/geo';
import { SLOTS, TAXA_SERVICO, bloqueadoPorConferencia, jornada, slotDe, taxaUsuarioDe } from '../lib/regras';
import { Pagamento as PagamentoModal } from '../components/Pagamento';
import { emDestaque } from '../data/useAnuncios';
import type { Pagamento } from '../store/acoes';
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
  const [pagando, setPagando] = useState(false);
  const verificado = useDB((d) => d.usuarios[d.sessao ?? '']?.verificacao === 'verificado');
  const [modoFicar, setModoFicar] = useState<'horas' | 'diarias'>('horas');
  const dono = useDB((d) => (a ? d.usuarios[a.donoId] : undefined));
  const anunciosDoDono = useDB((d) => d.anuncios);

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
  const hibrido = a.tipoPreco === 'diaria' && !!a.pacotes?.length;
  const tp: Anuncio['tipoPreco'] = hibrido && modoFicar === 'horas' ? 'pacote' : a.tipoPreco;
  const taxa = tp === 'pacote' ? taxaUsuarioDe(a, 'hora') : 0;
  const pes = a.porPessoa ? pessoas : 1;
  const hosp = a.porPessoa ? pessoas : 1;
  const beneficiosAqui = beneficios.filter((b) => b.anuncioId === a.id);
  const dist = onde ? distanciaKm(onde, a) : null;

  const alternarExtra = (e: Extra) => setExtras(extras.some((x) => x.nome === e.nome) ? extras.filter((x) => x.nome !== e.nome) : [...extras, e]);

  /** Confere os dados antes de abrir o pagamento. */
  function abrirPagamento() {
    setErro('');
    if (tp === 'pacote') {
      const inicio = quando === 'agora' ? Date.now() : Date.parse(dataHora);
      if (!inicio || Number.isNaN(inicio)) return setErro('Escolha a data e a hora.');
      if (inicio < Date.now() - 5 * 60_000) return setErro('Escolha um horário a partir de agora.');
    }
    if (bloqueadoPorConferencia(a!)) return setErro('Este espaço está aguardando a conferência do anfitrião. Tente de novo mais tarde.');
    setPagando(true);
  }

  function pagar(metodo: Pagamento) {
    setPagando(false);
    let r: { ok: true; id: string } | { ok: false; erro: string } | null = null;
    if (tp === 'pacote' && pacote) {
      const inicio = quando === 'agora' ? Date.now() : Date.parse(dataHora);
      r = reservarHora(a!, pacote, pes, extras, inicio, metodo);
    } else if (tp === 'diaria') {
      const [y, m, d] = checkinData.split('-').map(Number);
      r = reservarDiaria(a!, new Date(y, m - 1, d, 14, 0).getTime(), noites, pessoas, extras, metodo);
    } else if (a!.categoria === 'servicos') {
      r = chamarProfissional(a!, a!.unidadePreco === '/h' ? horas : 1, metodo);
    }
    if (!r) return;
    if (!r.ok) return setErro(r.erro);
    toast(a!.categoria === 'servicos' ? 'Chamado enviado' : 'Reserva confirmada');
    nav(`/reserva/${r.id}`);
  }

  const horario = (() => {
    const t = a.agenda.dias.map((h) => (h ? `${hhmm(h[0])} às ${hhmm(h[1])}` : 'fechado'));
    if (t.every((x) => x === t[0])) return t[0] === '00:00 às 24:00' ? 'Aberto 24 horas' : `Todos os dias, ${t[0]}`;
    return t.map((x, i) => `${DIAS[i]} ${x}`).join(', ');
  })();
  const total = tp === 'pacote' && pacote ? pacote.preco * pes + taxa + somaExtras
    : tp === 'diaria' ? (a.preco ?? 0) * noites * hosp + somaExtras
    : servico ? (a.preco ?? 0) * (a.unidadePreco === '/h' ? horas : 1) + TAXA_SERVICO : null;
  const temComod = Object.keys(COMODIDADES).filter((k) => a.comodidades.includes(k));

  return (
    <>
      <div className="capa-topo">
        <Miniatura a={a} grande />
        <div className="capa-acoes">
          <Voltar />
          <button className="coracao" aria-pressed={salvo} aria-label={salvo ? 'Tirar do livro dos sonhos' : 'Guardar no livro dos sonhos'} onClick={() => { alternarSonho(a.id); toast(salvo ? 'Saiu do livro dos sonhos' : 'Guardado no livro dos sonhos'); }}>
            <svg viewBox="0 0 24 24" fill={salvo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
          </button>
        </div>
      </div>

      <div className="ficha">
        <span className="catpill" style={{ ['--c' as string]: cat.cor }}><IconeCategoria c={a.categoria} tamanho={14} />{sub}</span>
        <h1>{a.titulo}</h1>
        <p className="meta" style={{ margin: '0 0 10px' }}>{a.bairro}{dist != null ? `, a ${formatarDistancia(dist)} de você` : ''}</p>
        <p className="desc">{a.descricao}</p>
        <div className="fatos">
          <div><b className="num">{virgula(a.notaQualidade)}</b><span>qualidade</span></div>
          <div><b className="num">{virgula(a.notaCustoBeneficio)}</b><span>custo-benefício</span></div>
          <div><b className="num">{a.totalAvaliacoes}</b><span>avaliações</span></div>
          {a.metragemM2 ? <div><b className="num">{a.metragemM2}</b><span>m²</span></div> : <div><b className="num">{a.totalSonhos}</b><span>sonham</span></div>}
        </div>
      </div>

      {(emDestaque(a) || (a.campanhaAte ?? 0) > Date.now()) && (
        <div className="row" style={{ marginTop: 12 }}>
          {emDestaque(a) && <span className="status aprovado">Em destaque</span>}
          {(a.campanhaAte ?? 0) > Date.now() && <span className="status">Campanha Celus do mês</span>}
        </div>
      )}
      {dono && (() => {
        const deles = anunciosDoDono.filter((x) => x.donoId === dono.id && x.totalAvaliacoes > 0);
        const n = deles.reduce((s2, x) => s2 + x.totalAvaliacoes, 0);
        const media = n ? deles.reduce((s2, x) => s2 + ((x.notaQualidade + x.notaCustoBeneficio) / 2) * x.totalAvaliacoes, 0) / n : null;
        return (
          <div className="anfitriao">
            <span className="avatar mini">{dono.foto ? <img src={dono.foto} alt="" /> : dono.nome.slice(0, 1)}</span>
            <div className="sp" style={{ minWidth: 0 }}>
              <b>{servico ? dono.nome.split(' ')[0] : `Anfitrião: ${dono.nome.split(' ')[0]}`}</b>
              <div className="hint">{dono.verificacao === 'verificado' ? 'Identidade verificada' : 'Identidade não verificada'}{media ? `. Nota ${virgula(media)} em ${n} avaliações` : '. Ainda sem avaliações'}</div>
              {dono.bio && <p className="desc" style={{ margin: '6px 0 0', fontSize: 14 }}>{dono.bio}</p>}
            </div>
          </div>
        );
      })()}

      {!servico && !imovel && (
        <div className="box storybox">
          {meusStories.length > 0 && <StoryRing lista={meusStories} rotulo={`${meusStories.length} agora`} cor={cat.cor} />}
          <div className="sp" style={{ minWidth: 0 }}>
            <b>{meusStories.length ? 'Stories de quem está aqui' : 'Ninguém postou daqui ainda'}</b>
            <div className="hint">Somem em 3 horas.</div>
          </div>
          {podePostar(a.id)
            ? <Link className="btn sm" to={`/story/${a.id}`}>Postar story daqui</Link>
            : <button className="btn sm ghost" onClick={() => { const r = checkin(a, onde); toast(r.ok ? 'Check-in feito' : r.erro); }}>Estou aqui</button>}
        </div>
      )}

      {!servico && (
        <>
          {temComod.length > 0 && (
            <>
              <h2>O que tem aqui</h2>
              <ul className="comod">{temComod.map((k) => <li key={k}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{COMODIDADES[k]}</li>)}</ul>
            </>
          )}
          <div className="box infos">
            <div className="sumline"><span>Capacidade</span><span>até {a.capacidade} {a.capacidade > 1 ? 'pessoas' : 'pessoa'}</span></div>
            {a.tipoAcesso && <div className="sumline"><span>Acesso</span><span>{ACESSO[a.tipoAcesso]}</span></div>}
            {a.limpezaInclusa && <div className="sumline"><span>Limpeza</span><span>Inclusa</span></div>}
            {tp === 'pacote' && <div className="sumline"><span>Funcionamento</span><span>{horario}</span></div>}
          </div>
        </>
      )}

      {beneficiosAqui.length > 0 && (
        <>
          <h2>Troque seus celus aqui</h2>
          <div className="stack">{beneficiosAqui.map((b) => (
            <div key={b.id} className="box linha">
              <div className="sp"><b>{b.nome}</b><div className="hint">Oferecido pelo local. Você tem <span className="num">{carteira}</span> celus.</div></div>
              <button className="btn sm" disabled={carteira < b.custo} onClick={() => { const c = resgatar(b.id); toast(c ? `${b.nome} resgatado. Código ${c}` : 'Saldo insuficiente'); }}><Moeda tamanho={14} /> <span className="num">{b.custo}</span></button>
            </div>
          ))}</div>
        </>
      )}

      {!servico && !imovel && bloqueadoPorConferencia(a) && <div className="alerta warn" style={{ marginTop: 18 }}><b>Aguardando conferência.</b> Depois de 5 locações seguidas sem ninguém no local, o anfitrião confere o espaço antes de liberar novas reservas.</div>}
      {!servico && !imovel && <SemaforoLocal a={a} marcas={marcas} />}

      <h2>{servico ? 'Como trabalha' : 'Manual de bons modos'}</h2>
      <div className="manual">{a.manualBonsModos}</div>

      {/* ---------- Reserva ---------- */}
      {hibrido && (
        <>
          <h2>Por quanto tempo você quer ficar?</h2>
          <div className="seg"><button aria-pressed={modoFicar === 'horas'} onClick={() => setModoFicar('horas')}>{a.subcategoria === 'camping' ? 'Passar o dia' : 'Algumas horas'}</button><button aria-pressed={modoFicar === 'diarias'} onClick={() => setModoFicar('diarias')}>{a.subcategoria === 'camping' ? 'Acampar' : 'Diárias'}</button></div>
        </>
      )}
      {tp === 'pacote' && a.pacotes && (
        <>
          <h2>{hibrido ? 'Pacote' : 'Quanto tempo?'}</h2>
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

      {tp === 'diaria' && (
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

      {(tp === 'pacote' || tp === 'diaria') && (
        <div className="box resumo">
          {tp === 'pacote' && pacote && <div className="sumline"><span>Pacote {rotuloHoras(pacote.horas)}{pes > 1 ? ` × ${pes}` : ''}</span><span>{brl(pacote.preco * pes)}</span></div>}
          {tp === 'diaria' && <div className="sumline"><span>{noites} diária{noites > 1 ? 's' : ''} × {brl(a.preco ?? 0)}{hosp > 1 ? ` × ${hosp} pessoas` : ''}</span><span>{brl((a.preco ?? 0) * noites * hosp)}</span></div>}
          {extras.map((e) => <div key={e.nome} className="sumline"><span>{e.nome}</span><span>{brl(e.preco)}</span></div>)}
          {tp === 'pacote' && taxa > 0 && <div className="sumline"><span>Taxa de serviço</span><span>{brl(taxa)}</span></div>}
          <div className="sumline"><span>Total</span><span>{brl(total ?? 0)}</span></div>
        </div>
      )}

      {servico && (
        <>
          {jornada(a).disponivel
            ? <div className="alerta ok" style={{ marginTop: 18 }}><b>Disponível agora</b>{dist != null ? ` a ${formatarDistancia(dist)} de você` : ''}. Freelancer: fica no máximo 12 h seguidas disponível e depois faz pausa de 6 h.</div>
            : <div className="alerta warn" style={{ marginTop: 18 }}><b>Indisponível agora.</b> Este profissional está fora do horário ou na pausa obrigatória.</div>}
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

      {a.categoria === 'ficar' && !verificado && <Link to="/verificar" className="alerta warn" style={{ display: 'block', marginTop: 14, color: 'var(--text)', textDecoration: 'none' }}><b>Verifique sua identidade</b> para reservar no Ficar. Leva um minuto.</Link>}
      {erro && <p className="erro" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
      {(tp === 'pacote' || servico || tp === 'diaria') && <p className="hint" style={{ marginTop: 10 }}>Pagamento em modo de teste: nenhuma cobrança real é feita.</p>}
      {a.donoId === uid && <p className="hint" style={{ marginTop: 10 }}>Este anúncio é seu.</p>}
      {pagando && total != null && <PagamentoModal total={total} titulo={a.titulo} onPagar={pagar} onFechar={() => setPagando(false)} />}
      {a.donoId !== uid && (
        <div className="acao-fixa">
          {total != null && <div className="acao-total"><span className="hint">Total</span><b className="num">{brl(total)}</b></div>}
          {(tp === 'pacote' || tp === 'diaria') && <button className="btn" onClick={abrirPagamento}>Confirmar e pagar</button>}
          {servico && (jornada(a).disponivel
            ? <button className="btn" onClick={abrirPagamento}>Chamar {a.titulo.split(',')[0]}</button>
            : <button className="btn" disabled>Indisponível agora</button>)}
          {imovel && <button className="btn" onClick={() => toast('Interesse enviado. O corretor responsável entra em contato pela plataforma.')}>Tenho interesse</button>}
        </div>
      )}
    </>
  );
}

function SemaforoLocal({ a, marcas }: { a: { lat: number; lng: number }; marcas: Parameters<typeof leitura>[2] }) {
  const agora = slotDe();
  return (
    <>
      <h2>Semáforo da região</h2>
      <div className="slots">{Object.entries(SLOTS).map(([k, n]) => {
        const l = leitura(a, k, marcas);
        return (
          <div key={k} className={`slot ${k === agora ? 'now' : ''}`}>
            <span className="hint">{n}</span>
            <b style={{ color: l.cor === 'sem' ? 'var(--muted)' : COR_CSS[l.cor] }}>{l.rotulo}</b>
            <span className="hint">{l.n} {l.n === 1 ? 'marcação' : 'marcações'}</span>
            <i className="bar" style={{ background: COR_CSS[l.cor] }} />
          </div>
        );
      })}</div>
      <p className="hint" style={{ marginTop: 8 }}>Cores marcadas por quem esteve na região nos últimos 30 dias. O horário destacado é o de agora. É percepção, não garantia.</p>
    </>
  );
}
