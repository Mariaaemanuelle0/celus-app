import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS } from '../data/catalogo';
import { Estrelas, Voltar, toast, useAgora } from '../components/ui';
import { brl, rotuloHoras } from '../lib/format';
import { AVISO_MIN, CARENCIA_MIN, cobranca, reembolso } from '../lib/regras';
import { avaliarAnuncio, avancarChamado, avancarTeste, cancelar, encerrar, estender, iniciarUso } from '../store/acoes';
import { useDB } from '../store/db';

const dataHora = (t: number) => new Date(t).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<string, string> = { confirmada: 'Confirmada', em_uso: 'Em uso', concluida: 'Concluída', cancelada: 'Cancelada', solicitado: 'Chamado enviado', aceito: 'Aceito', a_caminho: 'A caminho' };

export function ReservaPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const r = useDB((d) => d.reservas.find((x) => x.id === id));
  const a = useDB((d) => d.anuncios.find((x) => x.id === r?.anuncioId));
  const [confirmarCancel, setConfirmarCancel] = useState(false);

  // Modo demonstração: o profissional aceita e sai a caminho sozinho.
  useEffect(() => {
    if (!r || r.tipo !== 'servico') return;
    if (r.status === 'solicitado') { const t = setTimeout(() => avancarChamado(r.id, 'aceito'), 4000); return () => clearTimeout(t); }
    if (r.status === 'aceito') { const t = setTimeout(() => avancarChamado(r.id, 'a_caminho'), 4000); return () => clearTimeout(t); }
  }, [r]);

  if (!r || !a) return <div className="empty">Reserva não encontrada.</div>;
  if (r.status === 'em_uso') return <Navigate to={`/uso/${r.id}`} replace />;
  if (r.status === 'concluida' && !r.avaliadaPeloUsuario) return <Avaliar reservaId={r.id} />;

  const ree = reembolso(r);
  const podeCancelar = ['confirmada', 'solicitado', 'aceito'].includes(r.status);

  return (
    <>
      <Voltar para="/perfil" />
      <div className="eyebrow">{STATUS[r.status]}</div>
      <h1>{a.titulo}</h1>
      <p className="meta">
        {r.tipo === 'hora' && `${dataHora(r.inicio)} · pacote ${rotuloHoras(r.pacote?.horas ?? 0)}${r.pessoas > 1 ? ` · ${r.pessoas} pessoas` : ''}`}
        {r.tipo === 'diaria' && `Check-in ${dataHora(r.inicio)} · ${r.noites} diária${(r.noites ?? 1) > 1 ? 's' : ''}`}
        {r.tipo === 'servico' && `Chamado às ${new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
      </p>

      {r.tipo === 'servico' && ['solicitado', 'aceito', 'a_caminho'].includes(r.status) && (
        <div className="passos">
          {['solicitado', 'aceito', 'a_caminho'].map((s, i) => (
            <div key={s} className={`passo ${['solicitado', 'aceito', 'a_caminho'].indexOf(r.status) >= i ? 'on' : ''}`}><i />{STATUS[s]}</div>
          ))}
        </div>
      )}

      {r.status === 'confirmada' && (
        <div className="box" style={{ padding: 14, marginTop: 14 }}>
          {a.tipoAcesso === 'fechadura' && <><div className="eyebrow">Senha de uso único</div><div className="code num">{r.codigo}</div><div className="hint">Vale só para esta reserva e expira sozinha.</div></>}
          {a.tipoAcesso === 'responsavel' && <><div className="eyebrow">Quem libera a entrada</div><b>{a.responsavelLocal ?? 'Responsável local'}</b><div className="hint">Já avisamos do seu horário.</div></>}
          {(a.tipoAcesso === 'presencial' || !a.tipoAcesso) && <><div className="eyebrow">Acesso</div><b>{ACESSO.presencial}: o anfitrião recebe você</b><div className="hint">Código da reserva: <span className="num">{r.codigo}</span></div></>}
        </div>
      )}

      <div className="box resumo">
        <div className="sumline"><span>Valor</span><span>{brl(r.subtotal)}</span></div>
        {r.taxaUsuario > 0 && <div className="sumline"><span>Taxa de serviço</span><span>{brl(r.taxaUsuario)}</span></div>}
        {r.multa > 0 && <div className="sumline"><span>Excedente</span><span>{brl(r.multa)}</span></div>}
        <div className="sumline"><span>Total</span><span>{brl(r.total)}</span></div>
        {r.status === 'cancelada' && <div className="sumline"><span>Reembolso</span><span>{brl(r.reembolso ?? 0)}</span></div>}
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {r.status === 'confirmada' && r.tipo === 'hora' && <button className="btn" onClick={() => { iniciarUso(r.id); nav(`/uso/${r.id}`); }}>Cheguei, começar a usar</button>}
        {r.status === 'confirmada' && r.tipo === 'diaria' && <button className="btn" onClick={() => { encerrar(r.id); }}>Fazer check-out</button>}
        {r.status === 'a_caminho' && <button className="btn" onClick={() => avancarChamado(r.id, 'concluida')}>O serviço terminou</button>}
        {podeCancelar && !confirmarCancel && <button className="btn ghost" onClick={() => setConfirmarCancel(true)}>Cancelar</button>}
        {podeCancelar && confirmarCancel && (
          <div className="alerta warn">
            <b>Cancelar esta reserva?</b> {ree.regra} Você recebe {brl(ree.valor)} de volta.
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => { const v = cancelar(r.id); toast(`Cancelada. Reembolso de ${brl(v)}.`); setConfirmarCancel(false); }}>Sim, cancelar</button>
              <button className="btn sm ghost" onClick={() => setConfirmarCancel(false)}>Manter reserva</button>
            </div>
          </div>
        )}
        <Link className="btn ghost" to={`/anuncio/${a.id}`}>Ver o anúncio</Link>
      </div>
      {(r.status === 'confirmada') && <><h2>Manual de bons modos</h2><div className="manual">{a.manualBonsModos}</div></>}
      {r.tipo === 'servico' && r.status !== 'concluida' && <p className="hint" style={{ marginTop: 12 }}>Modo demonstração: o profissional aceita e sai a caminho sozinho em alguns segundos.</p>}
    </>
  );
}

export function UsoPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const agora = useAgora(500);
  const r = useDB((d) => d.reservas.find((x) => x.id === id));
  const a = useDB((d) => d.anuncios.find((x) => x.id === r?.anuncioId));
  if (!r || !a) return <div className="empty">Reserva não encontrada.</div>;
  if (r.status !== 'em_uso') return <Navigate to={`/reserva/${r.id}`} replace />;
  const c = cobranca(r, a, agora);
  const resto = c.restanteMin;
  const seg = Math.round(Math.abs(resto) * 60);
  const relogio = `${resto < 0 ? '+' : ''}${Math.floor(seg / 3600) ? Math.floor(seg / 3600) + ':' + String(Math.floor((seg % 3600) / 60)).padStart(2, '0') : Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  const ph = (a.pacotes?.[0].preco ?? 0) / (a.pacotes?.[0].horas ?? 1) * r.pessoas;

  return (
    <>
      <div className="eyebrow">Em uso agora</div>
      <h1>{a.titulo}</h1>
      <div className={`timer ${resto < 0 ? 'over' : ''}`}>
        <div className="lbl">{resto >= 0 ? 'Tempo restante' : c.cobravel > 0 ? 'Excedente (cobrando)' : 'Tolerância'}</div>
        <div className="clock num">{relogio}</div>
        <div className="hp"><i style={{ width: `${Math.max(0, Math.min(100, (resto / c.contratadoMin) * 100))}%` }} /></div>
        <div className="lbl">Contratado {rotuloHoras(c.contratadoMin / 60)}</div>
      </div>
      {resto <= AVISO_MIN && resto > 0 && <div className="alerta warn" style={{ marginTop: 12 }}><b>Faltam {Math.ceil(resto)} minutos.</b> Quer mais tempo? Estenda com um toque.</div>}
      {resto <= 0 && c.cobravel === 0 && <div className="alerta warn" style={{ marginTop: 12 }}><b>Seu tempo acabou.</b> Você tem {Math.max(0, Math.ceil(CARENCIA_MIN - c.excedente))} min de tolerância antes da cobrança por minuto.</div>}
      {c.cobravel > 0 && <div className="alerta bad" style={{ marginTop: 12 }}><b>Cobrança por minuto ativa.</b> {c.bateuTeto ? 'Chegou ao teto de 2× o valor da hora. Não cobramos mais que isso.' : `Teto: ${brl(c.teto)}.`}</div>}
      <button className="btn" style={{ marginTop: 12, background: 'var(--text)', color: 'var(--bg)' }} onClick={() => { estender(r.id); toast('Mais 1 hora adicionada'); }}>Estender +1 h por {brl(ph)}</button>
      <div className="box resumo">
        <div className="sumline"><span>Pacote e extras</span><span>{brl(c.subtotal - c.multa - r.extensoes * ph)}</span></div>
        {r.extensoes > 0 && <div className="sumline"><span>Extensões ({r.extensoes} h)</span><span>{brl(r.extensoes * ph)}</span></div>}
        <div className="sumline"><span>Excedente ({Math.round(c.cobravel)} min)</span><span>{brl(c.multa)}</span></div>
        <div className="sumline"><span>Taxa de serviço</span><span>{brl(r.taxaUsuario)}</span></div>
        <div className="sumline"><span>Total até agora</span><span>{brl(c.total)}</span></div>
      </div>
      {a.tipoAcesso === 'fechadura' && <div className="box" style={{ padding: 14, marginTop: 12 }}><div className="eyebrow">Senha de uso único</div><div className="code num">{r.codigo}</div></div>}
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { encerrar(r.id); nav(`/reserva/${r.id}`); }}>Encerrar e sair</button>
      <div className="demo row"><span>Teste do timer</span><span className="sp" /><button className="btn sm ghost" onClick={() => avancarTeste(r.id, 10)}>Avançar 10 min</button></div>
    </>
  );
}

function Avaliar({ reservaId }: { reservaId: string }) {
  const nav = useNavigate();
  const r = useDB((d) => d.reservas.find((x) => x.id === reservaId))!;
  const a = useDB((d) => d.anuncios.find((x) => x.id === r.anuncioId))!;
  const [q, setQ] = useState(0);
  const [cb, setCb] = useState(0);
  const [dev, setDev] = useState<boolean | undefined>(undefined);
  const servico = a.categoria === 'servicos';
  const precisaDevolveu = !a.limpezaInclusa && !servico && r.tipo !== 'servico';
  return (
    <>
      <div className="alerta ok">Total final: <b>{brl(r.total)}</b>{r.multa > 0 ? ` (inclui ${brl(r.multa)} de excedente)` : ''}.</div>
      <h1 style={{ marginTop: 16 }}>Como foi?</h1>
      <p className="lead">{a.titulo} · {CATEGORIAS[a.categoria].nome}</p>
      <div className="stack">
        <div className="box axis"><b>{servico ? 'Qualidade do serviço' : 'Qualidade'}</b><p>{servico ? 'Fez bem o trabalho combinado?' : 'Estava limpo e funcionou como o anúncio dizia?'}</p><Estrelas valor={q} onChange={setQ} rotulo="Qualidade" /></div>
        <div className="box axis"><b>Custo-benefício</b><p>Valeu o que você pagou?</p><Estrelas valor={cb} onChange={setCb} rotulo="Custo-benefício" /></div>
        {precisaDevolveu && (
          <div className="box axis"><b>Você deixou como recebeu?</b><p>Este espaço não tem limpeza contratada.</p>
            <div className="seg"><button aria-pressed={dev === true} onClick={() => setDev(true)}>Sim</button><button aria-pressed={dev === false} onClick={() => setDev(false)}>Não</button></div>
          </div>
        )}
        <button className="btn" disabled={!q || !cb || (precisaDevolveu && dev === undefined)} onClick={() => { avaliarAnuncio(r.id, q, cb, dev); toast('Avaliação enviada · +10 celus'); nav('/perfil'); }}>Enviar avaliação</button>
        <p className="hint">Só estrelas, sem comentário. O anfitrião também avalia você.</p>
      </div>
    </>
  );
}
