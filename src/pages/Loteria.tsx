import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Moeda, Voltar, toast, useAgora } from '../components/ui';
import {
  ELEMENTOS_MAR, LOT_BILHETE, LOT_DIAS, LOT_ESCOLHE, LOT_HORA, LOT_POR_CONCURSO, LOT_PREMIO_2, LOT_REVELA_S, LOT_SHOW_S, NOME_LOTERIA,
  acertos, diaLocal, elementoMar, numeroConcurso, proximoConcurso, quandoConcurso, resultadoConcurso,
} from '../lib/regras';
import { apostar, apurarLoteria, estadoLoteria, premioPrevisto } from '../store/acoes';
import { carteiraDe, useDB, useUsuario } from '../store/db';
import type { Bilhete } from '../data/types';

const DIAS_TXT = 'terça, quinta e sábado';
const dataCurta = (dia: string) => { const [a, m, d] = dia.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }); };
const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Concurso cuja apresentação está acontecendo agora (das 20 h até o fim do show), se houver. */
function concursoAoVivo(agora: number): string | null {
  const dia = diaLocal(agora); const q = quandoConcurso(dia);
  return LOT_DIAS.includes(new Date(agora).getDay()) && agora >= q && agora < q + LOT_SHOW_S * 1000 ? dia : null;
}

function Relogio({ ate }: { ate: number }) {
  const agora = useAgora(1000);
  const s = Math.max(0, Math.round((ate - agora) / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return <span className="num lot-relogio">{d ? `${d}d ` : ''}{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>;
}

function Elementos({ ids, marcar }: { ids: string[]; marcar?: string[] }) {
  return <span className="lot-trio">{ids.map((x) => <span key={x} className={`lot-mini ${marcar?.includes(x) ? 'acerto' : ''}`} title={elementoMar(x).nome}>{elementoMar(x).e}</span>)}</span>;
}

function LinhaBilhete({ b }: { b: Bilhete }) {
  const saiu = b.status !== 'aguardando' ? resultadoConcurso(b.dia) : undefined;
  return (
    <div className="sumline lot-bilhete">
      <span><Elementos ids={b.escolha} marcar={saiu} /><span className="hint" style={{ display: 'block' }}>Concurso {numeroConcurso(b.dia)}, {dataCurta(b.dia)}{b.acertos !== undefined ? `. ${b.acertos} ${b.acertos === 1 ? 'acerto' : 'acertos'}` : ''}</span></span>
      <span className={`status ${b.status === 'ganhou' ? 'aprovado' : b.status === 'aguardando' ? 'pendente' : ''}`}>{b.status === 'ganhou' ? `+${fmt(b.premio ?? 0)}` : b.status === 'aguardando' ? 'Aguardando' : 'Não foi'}</span>
    </div>
  );
}

export function LoteriaPage() {
  const u = useUsuario()!;
  const nav = useNavigate();
  const agora = useAgora(1000);
  const saldo = useDB((d) => carteiraDe(d, u.id).saldo);
  const bilhetes = useDB((d) => d.bilhetes);
  const loteria = useDB((d) => d.loteria);
  const est = estadoLoteria({ loteria });
  const prox = proximoConcurso(agora, est.ultimoApurado);
  const premio = premioPrevisto({ loteria, bilhetes }, prox.dia);
  const meus = bilhetes.filter((b) => b.userId === u.id);
  const nesteConcurso = meus.filter((b) => b.dia === prox.dia);
  const aoVivo = concursoAoVivo(agora);
  const [escolha, setEscolha] = useState<string[]>([]);
  const [erro, setErro] = useState('');

  const alternar = (id: string) => setEscolha((e) => e.includes(id) ? e.filter((x) => x !== id) : e.length < LOT_ESCOLHE ? [...e, id] : e);
  const surpresinha = () => { const ids = ELEMENTOS_MAR.map((x) => x.id).sort(() => Math.random() - 0.5); setEscolha(ids.slice(0, LOT_ESCOLHE)); };
  const jogar = () => {
    const r = apostar(escolha);
    if (!r.ok) { setErro(r.erro); return; }
    setErro(''); toast('Bilhete feito. Boa sorte!'); setEscolha([]);
  };
  const adiantar = () => { const dia = prox.dia; apurarLoteria(true); nav(`/loteria/ao-vivo?dia=${dia}`); };

  return (
    <>
      <Voltar para="/perfil" />
      <h1>{NOME_LOTERIA}</h1>
      <p className="lead">Escolha {LOT_ESCOLHE} entre {ELEMENTOS_MAR.length} elementos do mar. Acertou os {LOT_ESCOLHE}, leva o prêmio. Se ninguém acertar, acumula. Sorteio ao vivo {DIAS_TXT}, às {LOT_HORA} h.</p>

      {aoVivo && <Link to="/loteria/ao-vivo" className="lot-aovivo-faixa"><span className="aovivo" aria-hidden="true" /> Sorteio ao vivo agora. Assistir ›</Link>}

      <div className="lot-premio">
        <span className="eyebrow">Concurso {numeroConcurso(prox.dia)}, {dataCurta(prox.dia)} às {LOT_HORA} h</span>
        <span className="lot-premio-valor"><Moeda tamanho={30} /><b className="num">{fmt(premio)}</b><span className="hint">celus</span></span>
        {est.concursos[0]?.acumulou && <span className="lot-acumulou">Acumulou!</span>}
        <span className="hint">Apostas fecham em <Relogio ate={prox.fecha} /></span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', margin: '22px 0 10px' }}>
        <h2 style={{ margin: 0 }}>Seu jogo <span className="hint num">{escolha.length}/{LOT_ESCOLHE}</span></h2>
        <button className="btn sm ghost" onClick={surpresinha}>Surpresinha</button>
      </div>
      <div className="lot-grade">
        {ELEMENTOS_MAR.map((x) => (
          <button key={x.id} className="lot-bicho" aria-pressed={escolha.includes(x.id)} onClick={() => alternar(x.id)} aria-label={x.nome}>
            <span className="lot-e" aria-hidden="true">{x.e}</span><span className="lot-nome">{x.nome}</span>
          </button>
        ))}
      </div>
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
      <div className="lot-jogar">
        <span className="hint lot-jogar-info"><span className="row" style={{ gap: 6 }}><Moeda tamanho={14} /><b className="num">{fmt(saldo)}</b> celus</span><span>{nesteConcurso.length}/{LOT_POR_CONCURSO} bilhetes neste concurso</span></span>
        <button className="btn" disabled={escolha.length !== LOT_ESCOLHE || saldo < LOT_BILHETE || nesteConcurso.length >= LOT_POR_CONCURSO} onClick={jogar}>Jogar por {LOT_BILHETE} celus</button>
      </div>
      {nesteConcurso.length > 0 && <button className="back" style={{ marginTop: 10 }} onClick={adiantar}>Adiantar o sorteio (teste)</button>}

      {meus.length > 0 && <><h2>Seus bilhetes</h2><div className="box" style={{ padding: '4px 14px' }}>{meus.slice(0, 20).map((b) => <LinhaBilhete key={b.id} b={b} />)}</div></>}

      <h2>Últimos concursos</h2>
      {est.concursos.length ? <div className="stack">{est.concursos.slice(0, 8).map((c) => (
        <Link key={c.dia} to={`/loteria/ao-vivo?dia=${c.dia}`} className="box lot-concurso">
          <span><b>Concurso {numeroConcurso(c.dia)}</b><span className="hint" style={{ display: 'block' }}>{dataCurta(c.dia)}. {c.acumulou ? 'Ninguém acertou os 3: acumulou' : `${c.ganhadores3} ${c.ganhadores3 === 1 ? 'ganhador' : 'ganhadores'}, ${fmt(c.premio3)} celus cada`}</span></span>
          <Elementos ids={c.saiu} />
        </Link>
      ))}</div> : <div className="empty">O primeiro sorteio ao vivo é {dataCurta(prox.dia)}, às {LOT_HORA} h.</div>}

      <h2>Como funciona</h2>
      <div className="box" style={{ padding: '4px 14px' }}>
        <div className="sumline"><span>3 acertos</span><span>Prêmio principal</span></div>
        <div className="sumline"><span>2 acertos</span><span>{LOT_PREMIO_2} celus</span></div>
        <div className="sumline"><span>Bilhete</span><span>{LOT_BILHETE} celus</span></div>
        <div className="sumline"><span>Por concurso</span><span>até {LOT_POR_CONCURSO} bilhetes</span></div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>70% de cada bilhete vai para o prêmio, e a Celus coloca mais celus em todo concurso. Se mais de uma pessoa acertar os 3, o prêmio é dividido. Só celus, que são pontos: não se compram com dinheiro e não se sacam. Só para maiores de 18 anos com identidade verificada.</p>
    </>
  );
}

/** Apresentação ao vivo: os 3 elementos saem um a um. Com ?dia= de um concurso já apurado, mostra a reprise. */
export function SorteioAoVivo() {
  const u = useUsuario()!;
  const [q] = useSearchParams();
  const agora = useAgora(110);
  const bilhetes = useDB((d) => d.bilhetes);
  const loteria = useDB((d) => d.loteria);
  const est = estadoLoteria({ loteria });
  const vivo = concursoAoVivo(agora);
  const pedido = q.get('dia');
  const dia = pedido ?? vivo ?? proximoConcurso(agora, est.ultimoApurado).dia;
  const [inicioReprise] = useState(() => Date.now());
  // Ao vivo conta a partir das 20 h; reprise (concurso já apurado ou adiantado no teste) conta a partir de quando a tela abriu.
  const reprise = !!pedido && pedido !== vivo;
  const inicio = reprise ? inicioReprise : quandoConcurso(dia);
  const t = (agora - inicio) / 1000;
  const saiu = resultadoConcurso(dia);
  const nSaiu = LOT_REVELA_S.filter((s) => t >= s).length;
  const revelados = saiu.slice(0, nSaiu);
  const terminou = t >= LOT_SHOW_S;
  const concurso = est.concursos.find((c) => c.dia === dia);
  const meus = bilhetes.filter((b) => b.userId === u.id && b.dia === dia);
  const melhor = Math.max(0, ...meus.map((b) => acertos(b.escolha, revelados)));
  const girando = ELEMENTOS_MAR[Math.floor(agora / 110) % ELEMENTOS_MAR.length];

  useEffect(() => { if (terminou && !reprise) apurarLoteria(); }, [terminou, reprise]);

  return (
    <>
      <Voltar para="/loteria" />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Concurso {numeroConcurso(dia)}</h1>
        {t >= 0 && !terminou && <span className="lot-live"><span className="aovivo" aria-hidden="true" />{reprise ? 'Reprise' : 'Ao vivo'}</span>}
      </div>
      <p className="meta">{dataCurta(dia)} às {LOT_HORA} h</p>

      {t < 0 ? (
        <div className="lot-palco">
          <span className="hint">O sorteio começa em</span>
          <Relogio ate={inicio} />
          <span className="hint">Deixe esta tela aberta para assistir ao vivo.</span>
        </div>
      ) : (
        <div className="lot-palco">
          <div className="lot-globo" aria-hidden="true"><span className={terminou ? '' : 'gira'}>{terminou ? '🌊' : girando.e}</span></div>
          <div className="lot-slots">
            {saiu.map((x, i) => (
              <div key={i} className={`lot-slot ${i < nSaiu ? 'saiu' : ''}`} aria-live="polite">
                {i < nSaiu ? <><span className="lot-e">{elementoMar(x).e}</span><span className="lot-nome">{elementoMar(x).nome}</span></> : <span className="num hint">{i + 1}º</span>}
              </div>
            ))}
          </div>
          <span className="hint">{terminou ? 'Sorteio encerrado.' : nSaiu < saiu.length ? `Saindo o ${nSaiu + 1}º elemento...` : 'Conferindo os bilhetes...'}</span>
        </div>
      )}

      {meus.length > 0 && t >= 0 && <>
        <h2>Seus bilhetes {melhor > 0 && <span className="lot-acertos num">{melhor} {melhor === 1 ? 'acerto' : 'acertos'}</span>}</h2>
        <div className="box" style={{ padding: '4px 14px' }}>{meus.map((b) => <div key={b.id} className="sumline lot-bilhete"><Elementos ids={b.escolha} marcar={revelados} /><span className="num">{acertos(b.escolha, revelados)}/{LOT_ESCOLHE}</span></div>)}</div>
      </>}

      {terminou && concurso && (
        <div className={`box lot-final ${concurso.acumulou ? '' : 'saiu'}`}>
          {concurso.acumulou
            ? <><b>Ninguém acertou os 3. Acumulou!</b><span className="hint">O próximo concurso começa com {fmt(estadoLoteria({ loteria }).acumulado)} celus, mais os bilhetes.</span></>
            : <><b>{concurso.ganhadores3} {concurso.ganhadores3 === 1 ? 'ganhador' : 'ganhadores'} do prêmio principal</b><span className="hint">{fmt(concurso.premio3)} celus para cada.</span></>}
          {concurso.ganhadores2 > 0 && <span className="hint">{concurso.ganhadores2} {concurso.ganhadores2 === 1 ? 'bilhete' : 'bilhetes'} com 2 acertos: {LOT_PREMIO_2} celus cada.</span>}
        </div>
      )}
      {terminou && <Link to="/loteria" className="btn ghost" style={{ marginTop: 16 }}>Jogar no próximo concurso</Link>}
    </>
  );
}
