import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS, COMODIDADES, ORDEM_CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Agenda, Anuncio, Categoria, Extra, Lote, Pacote } from '../data/types';
import { agendaPadrao } from '../data/seed';
import { Estrelas, IconeCategoria, Miniatura, Voltar, lerImagem, toast, useAgora, useLocalizacao } from '../components/ui';
import { emDestaque } from '../data/useAnuncios';
import { ComoChegar } from '../components/Rota';
import { brl, dataEvento, rotuloPreco, virgula } from '../lib/format';
import { centroPiloto } from '../lib/geo';
import {
  COMISSAO, COMISSAO_REDUZIDA, LIMITE_SEM_SUPERVISAO, TAXA_INGRESSO, bloqueadoPorConferencia, jornada, parteAnfitriao, pedePagamentoPorFora, precisaSupervisao, repasse,
} from '../lib/regras';
import {
  alternarDisponivel, arquivarPorFora, cancelarEvento, validarIngresso, assumirAnuncio, avaliarHospede, criarAnuncioAssistido, avancarChamado, confirmarChegada, conferirEspaco, destravarCodigo, conferirRevisao, criarAnuncio, criarBeneficio, decidirAnuncio, decidirDenuncia,
  denunciarStory, editarAnuncio, hhmm, pausarAnuncio, salvarAgenda, storiesAtivos,
} from '../store/acoes';
import { useDB, useUsuario } from '../store/db';

const STATUS_AN: Record<string, string> = { pendente: 'Aguardando aprovação', aprovado: 'No mapa', recusado: 'Recusado', pausado: 'Pausado', convite: 'Esperando o anfitrião' };

/* ---------------- Painel ---------------- */
const dataCurta = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const dataHoraCurta = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const horasTxt = (min: number) => { const m = Math.floor(min); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${Math.max(1, m)} min`; };
const ESTADO_REPASSE = { retido: 'Retido até o uso', agendado: 'Libera em', liberado: 'Liberado', nenhum: '' } as const;

export function Painel() {
  const u = useUsuario()!;
  useAgora(30_000);
  const anuncios = useDB((d) => d.anuncios);
  const reservas = useDB((d) => d.reservas);
  const usuarios = useDB((d) => d.usuarios);
  const stories = useDB((d) => d.stories);
  const denuncias = useDB((d) => d.denuncias);
  const beneficios = useDB((d) => d.beneficios);
  const [benef, setBenef] = useState({ anuncioId: '', nome: '', custo: 30 });
  const [denunciar, setDenunciar] = useState<string | null>(null);

  const meus = anuncios.filter((a) => a.donoId === u.id && a.status !== 'convite');
  const servicos = meus.filter((a) => a.categoria === 'servicos');
  const recebidas = reservas.filter((r) => meus.some((a) => a.id === r.anuncioId));
  const chamados = recebidas.filter((r) => r.tipo === 'servico' && ['solicitado', 'aceito', 'a_caminho', 'em_andamento'].includes(r.status));
  const historico = recebidas.filter((r) => !chamados.includes(r));
  const comRepasse = recebidas.map((r) => ({ r, rep: repasse(r) })).filter((x) => x.rep.estado !== 'nenhum');
  const aLiberar = comRepasse.filter((x) => x.rep.estado !== 'liberado').reduce((s, x) => s + parteAnfitriao(x.r), 0);
  const liberado = comRepasse.filter((x) => x.rep.estado === 'liberado').reduce((s, x) => s + parteAnfitriao(x.r), 0);
  const avaliados = meus.filter((a) => a.totalAvaliacoes > 0 && a.donoId === u.id);
  const nAval = avaliados.reduce((s, a) => s + a.totalAvaliacoes, 0);
  const notaAnfitriao = nAval ? avaliados.reduce((s, a) => s + ((a.notaQualidade + a.notaCustoBeneficio) / 2) * a.totalAvaliacoes, 0) / nAval : null;
  const reduzida = u.comissaoReduzidaAte && u.comissaoReduzidaAte > Date.now();
  const storiesMeus = storiesAtivos(stories).filter((s) => meus.some((a) => a.id === s.anuncioId)) as typeof stories;
  const anuncioDe = (id: string) => anuncios.find((a) => a.id === id);

  if (!meus.length) return (
    <>
      <ConvitesRecebidos />
      <CadastrosAssistidos />
      <h1>Seu espaço ou serviço trabalhando por você</h1>
      <p className="lead">Uma varanda, uma sala, uma vaga, um banheiro com chuveiro ou o seu serviço. Você define preço, horários e extras.</p>
      <ol className="etapas">
        <li><b>Cadastre</b><span>Fotos, preço por pacote e o manual de bons modos. Leva poucos minutos.</span></li>
        <li><b>A equipe Celus revisa</b><span>Conferimos tudo antes de aparecer no mapa.</span></li>
        <li><b>Receba 85% de cada reserva</b><span>A Celus fica com 15%. Você recebe pelo app, sem cobrar nada no local.</span></li>
      </ol>
      <Link className="btn" to="/renda/anunciar">Anunciar agora</Link>
      <TenhoCodigo />
    </>
  );

  return (
    <>
      <ConvitesRecebidos />
      <h1>Seu painel</h1>

      {servicos.filter((a) => a.status === 'aprovado').map((a) => {
        const j = jornada(a);
        return (
          <div key={a.id} className={`turno ${j.disponivel ? 'on' : ''}`}>
            <div className="sp" style={{ minWidth: 0 }}>
              <b>{j.disponivel ? 'Você está disponível' : 'Você está indisponível'}</b>
              <div className="hint">{a.titulo}. {j.disponivel ? `Aparece no mapa por mais ${horasTxt(j.restanteMin)}.` : j.pausaMin > 0 ? `Pausa obrigatória: volta em ${horasTxt(j.pausaMin)}.` : 'Ligue para aparecer no mapa e receber chamados.'}</div>
            </div>
            <button className="chave" role="switch" aria-checked={j.disponivel} aria-label="Disponível agora" disabled={!j.disponivel && j.pausaMin > 0}
              onClick={() => { const r = alternarDisponivel(a.id); toast(r.ok ? (j.disponivel ? 'Você saiu do mapa' : 'Você está no mapa. Jornada de até 12 h') : r.erro); }}><i /></button>
          </div>
        );
      })}

      {chamados.length > 0 && (
        <>
          <h2>Chamados</h2>
          <div className="stack">{chamados.map((r) => {
            const cliente = usuarios[r.userId];
            return (
              <div key={r.id} className="box chamado">
                <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><span className="avatar mini">{cliente?.foto ? <img src={cliente.foto} alt={`Foto de ${cliente.nome}`} /> : cliente?.nome.slice(0, 1)}</span><b className="sp">{cliente?.nome.split(' ')[0] ?? 'Cliente'}</b><span className="preco">{brl(parteAnfitriao(r))}</span></div>
                <div className="meta">{r.horasServico && anuncioDe(r.anuncioId)?.unidadePreco === '/h' ? `${r.horasServico} h de serviço. ` : ''}Pedido às {new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Você recebe o valor já com a comissão descontada.</div>
                <div className="row" style={{ marginTop: 10 }}>
                  {r.status === 'solicitado' && <><button className="btn sm" onClick={() => { avancarChamado(r.id, 'aceito'); toast('Chamado aceito'); }}>Aceitar</button><button className="btn sm ghost" onClick={() => { avancarChamado(r.id, 'recusado'); toast('Chamado recusado. O cliente não paga nada'); }}>Recusar</button></>}
                  {r.status === 'aceito' && <button className="btn sm" onClick={() => avancarChamado(r.id, 'a_caminho')}>Estou a caminho</button>}
                  {r.status === 'em_andamento' && <button className="btn sm" onClick={() => { avancarChamado(r.id, 'concluida'); toast('Serviço concluído'); }}>Concluí o serviço</button>}
                </div>
                {['aceito', 'a_caminho'].includes(r.status) && r.destino && <ComoChegar lat={r.destino.lat} lng={r.destino.lng} rotulo="Ir até o cliente" />}
                {r.status === 'a_caminho' && <ConferirCodigo reservaId={r.id} rotulo="Chegou? Confira se é o rosto da foto e peça o código" />}
              </div>
            );
          })}</div>
        </>
      )}

      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="box kpi"><b className="num">{brl(aLiberar)}</b><span>a liberar</span></div>
        <div className="box kpi"><b className="num">{brl(liberado)}</b><span>liberado</span></div>
        <div className="box kpi"><b className="num">{notaAnfitriao ? virgula(notaAnfitriao) : 'Novo'}</b><span>sua nota</span></div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Valores já sem a comissão. Sua comissão hoje: {reduzida ? `${Math.round(COMISSAO_REDUZIDA * 100)}% até ${dataCurta(u.comissaoReduzidaAte!)}` : `${Math.round(COMISSAO * 100)}%`}.
        {' '}Repasse D+1 depois do uso; estadias, 24 h após o check-in.
      </p>

      <h2>Meus anúncios</h2>
      <div className="stack">{meus.map((a) => (
        <div key={a.id} className="box anuncio-meu">
          <div className="listrow" style={{ padding: 0 }}>
            <Miniatura a={a} />
            <div><span className="t">{a.titulo}</span><span className="meta">{rotuloPreco(a)}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className={`status ${a.status}`}>{STATUS_AN[a.status]}</span>
                {emDestaque(a) && <span className="status aprovado">Destaque até {dataHoraCurta(a.destaqueAte!)}</span>}
                {a.revisar && <span className="status pendente">Mudanças em revisão</span>}
              </span>
            </div>
          </div>
          {bloqueadoPorConferencia(a) ? (
            <div className="alerta warn" style={{ marginTop: 10 }}>
              <b>Confira o espaço.</b> Foram {LIMITE_SEM_SUPERVISAO} locações seguidas sem ninguém no local. Novas reservas ficam travadas até você conferir.
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { conferirEspaco(a.id); toast('Espaço conferido. Reservas liberadas'); }}>Conferi, está tudo em ordem</button>
            </div>
          ) : precisaSupervisao(a) && (a.semSupervisao ?? 0) > 0 ? (
            <p className="hint" style={{ margin: '8px 0 0' }}>{a.semSupervisao} de {LIMITE_SEM_SUPERVISAO} locações sem conferência.</p>
          ) : null}
          {a.tipoPreco === 'ingresso' && a.lotes && a.evento && (
            <div className="vendas">
              <div className="hint">{a.evento.cancelado ? 'Evento cancelado' : `${dataEvento(a.evento.inicio)}`}</div>
              {a.lotes.map((l) => (
                <div key={l.id} className="vendas-linha"><span className="sp">{l.nome}</span><span className="num">{l.vendidos}/{l.qtd}</span><i style={{ width: `${Math.min(100, (l.vendidos / l.qtd) * 100)}%` }} /></div>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            {a.tipoPreco === 'ingresso' && a.status === 'aprovado' && !a.evento?.cancelado && <Link className="btn sm" to={`/renda/portaria/${a.id}`}>Portaria</Link>}
            <Link className="btn sm ghost" to={`/renda/editar/${a.id}`}>Editar</Link>
            {a.tipoPreco !== 'valor' && a.tipoPreco !== 'ingresso' && a.categoria !== 'servicos' && <Link className="btn sm ghost" to={`/renda/agenda/${a.id}`}>Agenda</Link>}
            {(a.status === 'aprovado' || a.status === 'pausado') && <button className="btn sm ghost" onClick={() => pausarAnuncio(a.id)}>{a.status === 'pausado' ? 'Reativar' : 'Pausar'}</button>}
          </div>
        </div>
      ))}</div>
      <Link className="btn ghost" style={{ marginTop: 12 }} to="/renda/anunciar">Anunciar outro</Link>

      <CadastrosAssistidos />

      <h2>Reservas e repasses</h2>
      {historico.length ? <div className="stack">{historico.map((r) => {
        const a = anuncioDe(r.anuncioId)!;
        const rep = repasse(r);
        return (
          <div key={r.id} className="box" style={{ padding: 14 }}>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}><span className="avatar mini">{usuarios[r.userId]?.foto ? <img src={usuarios[r.userId].foto} alt={`Foto de ${usuarios[r.userId].nome}`} /> : (usuarios[r.userId]?.nome ?? 'H').slice(0, 1)}</span><b className="sp">{usuarios[r.userId]?.nome ?? 'Hóspede'}</b><span className="preco">{r.status === 'cancelada' || r.status === 'recusado' ? '–' : brl(parteAnfitriao(r))}</span></div>
            <div className="meta">{a.titulo}, {dataHoraCurta(r.inicio)}{r.tipo === 'ingresso' ? `, ${r.ingressos?.length} ingresso${(r.ingressos?.length ?? 0) > 1 ? 's' : ''}` : ''}</div>
            <div className="hint" style={{ marginTop: 2 }}>
              {r.status === 'cancelada' ? 'Cancelada pelo cliente' : r.status === 'recusado' ? 'Chamado recusado' : `${ESTADO_REPASSE[rep.estado]}${rep.estado === 'agendado' && rep.quando ? ` ${dataCurta(rep.quando)}` : ''}`}
              {r.comissao && r.comissao < COMISSAO ? `. Comissão de ${Math.round(r.comissao * 100)}%` : ''}
            </div>
            {r.tipo !== 'ingresso' && r.status === 'confirmada' && a.tipoAcesso !== 'fechadura' && !r.chegadaConfirmada && <ConferirCodigo reservaId={r.id} rotulo="Quando a pessoa chegar, confira se é o rosto da foto e peça o código" />}
            {r.status === 'confirmada' && r.chegadaConfirmada && <div className="hint" style={{ color: 'var(--ok)' }}>Chegada confirmada pelo código.</div>}
            {r.status === 'concluida' && !r.avaliadaPeloAnfitriao && (
              <div style={{ marginTop: 8 }}><div className="hint">Avalie {a.categoria === 'servicos' ? 'o cliente' : 'o hóspede'} (só estrelas):</div><Estrelas valor={0} onChange={(n) => { avaliarHospede(r.id, n); toast('Avaliação enviada'); }} rotulo="Nota do cliente" /></div>
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
      <Link to="/celus" className="hint" style={{ display: 'block', marginTop: 10 }}>Use seus celus para destacar seu anúncio ou baixar a comissão</Link>

      <h2>Stories no seu espaço</h2>
      {storiesMeus.length ? <div className="stack">{storiesMeus.map((s) => {
        const ja = denuncias.some((d) => d.storyId === s.id);
        return (
          <div key={s.id} className="box" style={{ padding: 14 }}>
            <div className="row"><b className="sp">{s.autorNome}</b>{ja ? <span className="status pendente">Em análise</span> : <button className="btn sm ghost" onClick={() => setDenunciar(denunciar === s.id ? null : s.id)}>Denunciar</button>}</div>
            <div className="meta">{s.legenda || 'Sem legenda'}, em {anuncioDe(s.anuncioId)?.titulo}</div>
            {denunciar === s.id && <div className="stack" style={{ gap: 6, marginTop: 8 }}>{['Mostra pessoa sem autorização', 'Aparece criança', 'Conteúdo impróprio', 'Não foi feito neste local'].map((m) => <button key={m} className="btn sm ghost" style={{ textAlign: 'left' }} onClick={() => { denunciarStory(s.id, 'Anfitrião', m); setDenunciar(null); toast('Denúncia enviada. A curadoria Celus decide.'); }}>{m}</button>)}</div>}
          </div>
        );
      })}</div> : <div className="empty">Nenhum story no ar nos seus espaços agora.</div>}
      <p className="hint" style={{ marginTop: 8 }}>Você não pode apagar o story de um cliente, nem quando ele critica. Se algo quebrar as regras, denuncie e a curadoria Celus decide.</p>
    </>
  );
}

/** Anúncios que a equipe Celus cadastrou para o e-mail desta conta. */
function ConvitesRecebidos() {
  const u = useUsuario()!;
  const anuncios = useDB((d) => d.anuncios);
  const [aceite, setAceite] = useState(false);
  const meus = anuncios.filter((a) => a.status === 'convite' && a.convite?.email === u.email);
  if (!meus.length) return null;
  return (
    <div className="stack" style={{ marginBottom: 20 }}>
      {meus.map((a) => (
        <div key={a.id} className="convite">
          <div className="eyebrow">A equipe Celus cadastrou para você</div>
          <div className="listrow" style={{ padding: '8px 0 0' }}><Miniatura a={a} /><div><span className="t">{a.titulo}</span><span className="meta">{rotuloPreco(a)}</span></div></div>
          <p className="hint" style={{ margin: '10px 0' }}>Confira os dados. Depois de assumir, você edita preço, horários e fotos quando quiser.</p>
          <label className="check"><input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} /><span>Sou o responsável por este espaço, o imóvel e o condomínio permitem a atividade, e concordo que todo pagamento é feito pelo app, com comissão de {Math.round(COMISSAO * 100)}%.</span></label>
          <button className="btn" style={{ marginTop: 10 }} disabled={!aceite} onClick={() => { const r = assumirAnuncio(a.id); toast(r.ok ? 'Anúncio assumido. Já está no mapa' : r.erro); }}>Assumir anúncio</button>
        </div>
      ))}
    </div>
  );
}

/** Campo para quem recebeu o código por mensagem. */
function TenhoCodigo() {
  const [cod, setCod] = useState('');
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <button className="back" style={{ marginTop: 16 }} onClick={() => setAberto(true)}>A equipe Celus cadastrou meu espaço e tenho um código</button>;
  return (
    <form className="box" style={{ padding: 14, marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); const r = assumirAnuncio(cod); toast(r.ok ? 'Anúncio assumido. Já está no mapa' : r.erro); }}>
      <label className="campo">Código do cadastro<input className="num" placeholder="CEL-0000" value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} /></label>
      <p className="hint">Ao assumir, você confirma que é o responsável pelo espaço, que o imóvel e o condomínio permitem a atividade e que todo pagamento é feito pelo app.</p>
      <button className="btn sm" disabled={cod.length < 6}>Assumir anúncio</button>
    </form>
  );
}

/** Para a equipe: cadastros feitos no local, esperando o anfitrião assumir. */
function CadastrosAssistidos() {
  const u = useUsuario()!;
  const anuncios = useDB((d) => d.anuncios);
  const feitos = anuncios.filter((a) => a.convite?.porId === u.id);
  if (!u.equipeCelus || !feitos.length) return null;
  const link = typeof location !== 'undefined' ? location.origin : '';
  return (
    <>
      <h2>Cadastros que você fez</h2>
      <div className="stack">{feitos.map((a) => {
        const c = a.convite!;
        const msg = `Oi, ${c.nome.split(' ')[0]}! Seu espaço "${a.titulo}" já está cadastrado na Celus. Crie sua conta com o e-mail ${c.email} em ${link} e assuma o anúncio no Rentabilizar. Se pedir, o código é ${c.codigo}.`;
        return (
          <div key={a.id} className="box" style={{ padding: 14 }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}><b className="sp">{a.titulo}</b><span className={`status ${c.aceitoEm ? 'aprovado' : 'pendente'}`}>{c.aceitoEm ? 'Assumido' : 'Esperando'}</span></div>
            <div className="meta">{c.nome}, {c.email}</div>
            {!c.aceitoEm && (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="code num" style={{ fontSize: 18, letterSpacing: '.08em' }}>{c.codigo}</span><span className="sp" />
                <a className="btn sm ghost" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
              </div>
            )}
          </div>
        );
      })}</div>
    </>
  );
}

/** Campo onde quem recebe digita o código de chegada que a pessoa mostra. */
function ConferirCodigo({ reservaId, rotulo }: { reservaId: string; rotulo: string }) {
  const [cod, setCod] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <form className="conferir" onSubmit={(e) => { e.preventDefault(); const r = confirmarChegada(reservaId, cod); if (r.ok) { toast('Código conferido'); setCod(''); setMsg(''); } else setMsg(r.erro); }}>
      <label className="hint" htmlFor={`cod-${reservaId}`}>{rotulo}</label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input id={`cod-${reservaId}`} className="num" inputMode="numeric" maxLength={4} placeholder="0000" value={cod} onChange={(e) => setCod(e.target.value.replace(/\D/g, ''))} aria-label="Código de chegada" />
        <button className="btn sm" disabled={cod.length !== 4}>Conferir</button>
      </div>
      {msg && <p className="erro" style={{ fontSize: 13 }}>{msg}</p>}
    </form>
  );
}

/* ---------------- Anunciar e editar ---------------- */
type Rascunho = {
  cat: Categoria; sub: string; prof: string; titulo: string; bairro: string; descricao: string;
  pacotes: Pacote[]; horasFicar: boolean; preco: number; unidade: string; porPessoa: boolean; metragem: number; capacidade: number;
  comodidades: string[]; extras: Extra[]; acesso: NonNullable<Anuncio['tipoAcesso']>; responsavel: string; manual: string; limpeza: boolean; fotos: string[];
  inicioEvento: string; duracaoH: number; lotes: Lote[];
};
const RASCUNHO: Rascunho = {
  cat: 'descanso', sub: 'rede', prof: '', titulo: '', bairro: '', descricao: '',
  pacotes: [{ horas: 1, preco: 10 }, { horas: 3, preco: 25 }, { horas: 6, preco: 45 }], horasFicar: true, preco: 100, unidade: '/h', porPessoa: false, metragem: 10, capacidade: 1,
  comodidades: [], extras: [], acesso: 'responsavel', responsavel: '', manual: '', limpeza: false, fotos: [],
  inicioEvento: '', duracaoH: 5, lotes: [{ id: 'l1', nome: '1º lote', preco: 30, qtd: 100, vendidos: 0, meia: true }],
};
const PACOTES_FICAR: Pacote[] = [{ horas: 3, preco: 40 }, { horas: 6, preco: 65 }, { horas: 12, preco: 90 }];
const tipoPrecoDe = (c: Categoria, sub?: string): Anuncio['tipoPreco'] => (c === 'eventos' && sub === 'ingressos' ? 'ingresso' : c === 'ficar' ? 'diaria' : c === 'imoveis' ? 'valor' : c === 'servicos' ? 'servico' : 'pacote');

function deAnuncio(a: Anuncio): Rascunho {
  return {
    cat: a.categoria, sub: a.subcategoria, prof: a.profissao ?? '', titulo: a.titulo, bairro: a.bairro, descricao: a.descricao,
    pacotes: a.pacotes?.length ? a.pacotes : a.categoria === 'ficar' ? PACOTES_FICAR : RASCUNHO.pacotes, horasFicar: !!a.pacotes?.length,
    preco: a.preco ?? 0, unidade: a.unidadePreco ?? '', porPessoa: !!a.porPessoa, metragem: a.metragemM2 ?? 0, capacidade: a.capacidade,
    comodidades: a.comodidades, extras: a.extras, acesso: a.tipoAcesso ?? 'responsavel', responsavel: a.responsavelLocal ?? '', manual: a.manualBonsModos, limpeza: a.limpezaInclusa, fotos: a.fotos,
    inicioEvento: a.evento ? new Date(a.evento.inicio - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
    duracaoH: a.evento ? Math.round((a.evento.fim - a.evento.inicio) / 3600_000) : 5, lotes: a.lotes ?? RASCUNHO.lotes,
  };
}

function paraDados(f: Rascunho) {
  const tipo = tipoPrecoDe(f.cat, f.sub);
  if (tipo === 'ingresso') {
    const inicio = Date.parse(f.inicioEvento);
    const lotes = f.lotes.filter((l) => l.nome.trim() && l.qtd > 0).map((l, i) => ({ ...l, id: l.id || `l${i + 1}`, nome: l.nome.trim() }));
    return {
      categoria: f.cat, subcategoria: f.sub, titulo: f.titulo.trim(), descricao: f.descricao.trim(), bairro: f.bairro.trim(), tipoPreco: tipo,
      capacidade: lotes.reduce((s, l) => s + l.qtd, 0), comodidades: [], extras: [], manualBonsModos: f.manual.trim(), limpezaInclusa: false, fotos: f.fotos,
      evento: { inicio, fim: inicio + f.duracaoH * 3600_000 }, lotes,
    };
  }
  const servico = f.cat === 'servicos';
  const usaPacotes = tipo === 'pacote' || (f.cat === 'ficar' && f.horasFicar);
  return {
    categoria: f.cat, subcategoria: f.sub, profissao: servico ? f.prof : undefined, titulo: f.titulo.trim(), descricao: f.descricao.trim(), bairro: f.bairro.trim(),
    tipoPreco: tipo, pacotes: usaPacotes ? f.pacotes.filter((x) => x.preco > 0 && x.horas > 0).sort((a, b) => a.horas - b.horas) : undefined,
    preco: tipo === 'pacote' ? undefined : f.preco, unidadePreco: tipo === 'servico' || tipo === 'valor' ? f.unidade : undefined, porPessoa: tipo === 'pacote' || tipo === 'diaria' ? f.porPessoa : false,
    capacidade: servico ? 1 : f.capacidade, metragemM2: servico ? undefined : f.metragem, comodidades: servico ? [] : f.comodidades,
    extras: f.extras.filter((x) => x.nome.trim()), tipoAcesso: servico ? undefined : f.acesso, responsavelLocal: f.responsavel || undefined,
    manualBonsModos: f.manual.trim(), limpezaInclusa: f.limpeza, fotos: f.fotos,
  };
}

export function Anunciar() {
  const nav = useNavigate();
  const onde = useLocalizacao();
  const u = useUsuario()!;
  const [assistido, setAssistido] = useState(false);
  const [anf, setAnf] = useState({ nome: '', email: '' });
  const [erroAnf, setErroAnf] = useState('');
  return (
    <>
      {!u.foto && <Link to="/perfil/editar" className="alerta warn" style={{ display: 'block', marginBottom: 16, color: 'var(--text)', textDecoration: 'none' }}><b>Falta a foto do seu rosto.</b> Quem anuncia também aparece com foto. Tire uma selfie no perfil antes de enviar.</Link>}
      {u.equipeCelus && (
        <div className="box assistido">
          <label className="check"><input type="checkbox" checked={assistido} onChange={(e) => setAssistido(e.target.checked)} /><span><b>Cadastro assistido</b><br /><span className="hint">Estou no local cadastrando para um anfitrião. Ele recebe um código e assume o anúncio.</span></span></label>
          {assistido && (
            <div className="grid2" style={{ marginTop: 12 }}>
              <label className="campo">Nome do anfitrião<input id="as-nome" value={anf.nome} onChange={(e) => setAnf({ ...anf, nome: e.target.value })} /></label>
              <label className="campo">E-mail do anfitrião<input id="as-email" type="email" value={anf.email} onChange={(e) => setAnf({ ...anf, email: e.target.value })} /></label>
            </div>
          )}
          {erroAnf && <p className="erro" style={{ marginTop: 8 }}>{erroAnf}</p>}
        </div>
      )}
      <FormAnuncio inicial={RASCUNHO} titulo={assistido ? 'Cadastrar para um anfitrião' : 'Anunciar'} botao={assistido ? 'Gerar código para o anfitrião' : 'Enviar para aprovação'}
        lead={assistido
          ? `O pin fica onde você está agora${onde ? '' : ' (sem localização: usamos o centro da cidade piloto)'}. Como você esteve no local, o anúncio entra no mapa assim que o anfitrião assumir.`
          : `O anúncio fica na posição onde você está agora${onde ? '' : ' (sem localização: usamos o centro da cidade piloto)'}. A equipe Celus revisa antes de publicar.`}
        onEnviar={(f) => {
          const p = onde ?? centroPiloto();
          const dados = { ...paraDados(f), lat: p.lat, lng: p.lng, agenda: agendaPadrao(tipoPrecoDe(f.cat, f.sub)) };
          if (assistido) {
            const r = criarAnuncioAssistido(dados, anf);
            if (!r.ok) { setErroAnf(r.erro); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            toast(`Código ${r.codigo} gerado. Envie ao anfitrião`); nav('/renda'); return;
          }
          const id = criarAnuncio(dados);
          if (id) { toast('Enviado para a curadoria'); nav('/renda'); } else toast('Tire uma selfie no perfil antes de anunciar');
        }} />
    </>
  );
}

export function EditarAnuncio() {
  const { id } = useParams();
  const nav = useNavigate();
  const a = useDB((d) => d.anuncios.find((x) => x.id === id));
  const uid = useDB((d) => d.sessao);
  if (!a || a.donoId !== uid) return <div className="empty">Anúncio não encontrado.</div>;
  return (
    <>
      <Voltar para="/renda" />
      <FormAnuncio inicial={deAnuncio(a)} titulo="Editar anúncio" botao="Salvar mudanças" travarCategoria
        lead="Preço, pacotes e extras valem para as próximas reservas. Reservas já feitas mantêm o valor combinado. Mudanças no título, nas fotos ou na descrição passam pela curadoria, e o anúncio segue no ar enquanto isso."
        onEnviar={(f) => { editarAnuncio(a.id, paraDados(f)); toast('Mudanças salvas'); nav('/renda'); }} />
    </>
  );
}

function FormAnuncio({ inicial, titulo, lead, botao, onEnviar, travarCategoria }: { inicial: Rascunho; titulo: string; lead: string; botao: string; onEnviar: (f: Rascunho) => void; travarCategoria?: boolean }) {
  const [f, setF] = useState<Rascunho>(inicial);
  const [erro, setErro] = useState('');
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setF((x) => ({ ...x, [k]: v }));
  const tipo = tipoPrecoDe(f.cat, f.sub);
  const servico = f.cat === 'servicos';
  const mostraPacotes = tipo === 'pacote' || (f.cat === 'ficar' && f.horasFicar);

  function escolherCat(c: Categoria) {
    const sub = Object.keys(CATEGORIAS[c].subs)[0];
    setF((x) => ({ ...x, cat: c, sub, prof: c === 'servicos' ? Object.keys(PROFISSOES[sub])[0] : '', unidade: c === 'servicos' ? '/h' : c === 'imoveis' ? '/mês' : '', pacotes: c === 'ficar' ? PACOTES_FICAR : RASCUNHO.pacotes, preco: c === 'ficar' ? 140 : x.preco }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault(); setErro('');
    if (f.titulo.trim().length < 4) return setErro('Dê um título ao anúncio.');
    if (!f.fotos.length) return setErro('Adicione pelo menos uma foto.');
    if (tipo === 'ingresso') {
      const ini = Date.parse(f.inicioEvento);
      if (!ini || ini < Date.now()) return setErro('Escolha a data e a hora do evento, a partir de agora.');
      if (!f.lotes.some((l) => l.nome.trim() && l.qtd > 0 && l.preco >= 0)) return setErro('Crie pelo menos um lote com quantidade.');
    } else {
      if (mostraPacotes && !f.pacotes.some((p) => p.preco > 0)) return setErro('Defina o preço de pelo menos um pacote.');
      if (tipo !== 'pacote' && !(f.preco > 0)) return setErro('Defina o preço.');
    }
    if (!f.manual.trim()) return setErro(servico ? 'Conte como você trabalha.' : 'Escreva o manual de bons modos.');
    if ([f.titulo, f.descricao, f.manual, ...f.extras.map((x) => x.nome)].some(pedePagamentoPorFora)) return setErro('Na Celus, todo pagamento é feito antes, pelo app. Tire do texto qualquer pedido de dinheiro, maquininha ou Pix direto.');
    onEnviar(f);
  }

  return (
    <form onSubmit={enviar} noValidate>
      <h1>{titulo}</h1>
      <p className="lead">{lead}</p>
      <div className="stack">
        {!travarCategoria && <div><div className="flabel">Categoria</div><div className="cats-grade">{ORDEM_CATEGORIAS.map((k) => <button type="button" key={k} className="cat" style={{ ['--c' as string]: CATEGORIAS[k].cor }} aria-pressed={f.cat === k} onClick={() => escolherCat(k)}><IconeCategoria c={k} tamanho={15} />{CATEGORIAS[k].curto ?? CATEGORIAS[k].nome}</button>)}</div></div>}
        <div><div className="flabel">{servico ? 'Nicho' : 'Tipo'}</div><div className="chips">{Object.entries(CATEGORIAS[f.cat].subs).map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.sub === k} onClick={() => setF((x) => ({ ...x, sub: k, prof: servico ? Object.keys(PROFISSOES[k])[0] : '', ...(k === 'camping' ? { horasFicar: false, porPessoa: true, preco: 45, capacidade: 10 } : {}) }))}>{n}</button>)}</div></div>
        {servico && <div><div className="flabel">Profissão</div><div className="chips">{Object.entries(PROFISSOES[f.sub]).map(([k, n]) => <button type="button" key={k} className="chip" aria-pressed={f.prof === k} onClick={() => set('prof', k)}>{n}</button>)}</div></div>}
        <label className="campo">{servico ? 'Seu nome e profissão' : 'Título'}<input id="a-titulo" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={servico ? 'Ex.: Ana, eletricista' : 'Ex.: Varanda com rede e ducha'} /></label>
        <label className="campo">Bairro<input id="a-bairro" value={f.bairro} onChange={(e) => set('bairro', e.target.value)} /></label>
        <label className="campo">Descrição<textarea id="a-desc" rows={3} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></label>
        <div><div className="flabel">Fotos <span className="hint">mínimo 1, ideal 3 ou mais</span></div>
          <div className="uploads">{f.fotos.map((src, i) => <button type="button" key={i} className="fotoedit" onClick={() => set('fotos', f.fotos.filter((_, j) => j !== i))} aria-label="Remover foto"><img src={src} alt="" /><span>×</span></button>)}<label className="addfoto">+<input id="a-fotos" type="file" accept="image/*" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 6); const lidas = await Promise.all(fs.map((x) => lerImagem(x))); set('fotos', [...f.fotos, ...lidas].slice(0, 8)); }} /></label></div></div>

        {tipo === 'ingresso' && (
          <>
            <div className="grid2">
              <label className="campo">Começa<input id="a-inicio" type="datetime-local" value={f.inicioEvento} onChange={(e) => set('inicioEvento', e.target.value)} /></label>
              <label className="campo">Duração (horas)<input id="a-duracao" type="number" min={1} max={48} value={f.duracaoH} onChange={(e) => set('duracaoH', Number(e.target.value))} /></label>
            </div>
            <div><div className="flabel">Lotes de ingresso <span className="hint">o próximo lote abre quando o anterior esgota, ou venda os dois juntos</span></div>
              <div className="stack" style={{ gap: 10 }}>{f.lotes.map((l, i) => (
                <div key={i} className="box" style={{ padding: 12 }}>
                  <div className="exrow" style={{ gridTemplateColumns: '1fr 90px 40px' }}>
                    <input value={l.nome} aria-label="Nome do lote" onChange={(e) => set('lotes', f.lotes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                    <input type="number" min={0} value={l.preco} aria-label="Preço do lote" onChange={(e) => set('lotes', f.lotes.map((x, j) => j === i ? { ...x, preco: Number(e.target.value) } : x))} />
                    <button type="button" aria-label="Remover lote" disabled={l.vendidos > 0} onClick={() => set('lotes', f.lotes.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <label className="campo" style={{ flex: 1 }}>Quantidade<input type="number" min={Math.max(1, l.vendidos)} value={l.qtd} aria-label="Quantidade do lote" onChange={(e) => set('lotes', f.lotes.map((x, j) => j === i ? { ...x, qtd: Number(e.target.value) } : x))} /></label>
                    <label className="check" style={{ flex: 1, alignSelf: 'flex-end', paddingBottom: 12 }}><input type="checkbox" checked={l.meia} onChange={(e) => set('lotes', f.lotes.map((x, j) => j === i ? { ...x, meia: e.target.checked } : x))} /><span>Tem meia-entrada</span></label>
                  </div>
                  {l.vendidos > 0 && <p className="hint" style={{ margin: 0 }}>{l.vendidos} já vendidos.</p>}
                </div>
              ))}<button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set('lotes', [...f.lotes, { id: `l${Date.now()}`, nome: `${f.lotes.length + 1}º lote`, preco: (f.lotes.at(-1)?.preco ?? 30) + 15, qtd: 100, vendidos: 0, meia: true }])}>+ Adicionar lote</button></div>
              <p className="hint">Quem compra paga uma taxa de serviço de {Math.round(TAXA_INGRESSO * 100)}%. Você recebe o valor inteiro dos ingressos, um dia depois do evento. A lei garante meia-entrada a estudantes e outros públicos: confira as regras de cota com o advogado.</p>
            </div>
          </>
        )}
        {f.cat === 'ficar' && (
          <div className="box" style={{ padding: 14 }}>
            <label className="check"><input type="checkbox" checked={f.horasFicar} onChange={(e) => set('horasFicar', e.target.checked)} /><span><b>Também alugar por algumas horas</b><br /><span className="hint">{f.sub === 'camping' ? 'Day use: para quem quer passar o dia, usar a sombra, o chuveiro e a churrasqueira sem dormir.' : 'Para quem quer descansar entre compromissos, esperar um voo ou passar a noite. Só para espaço com entrada independente.'}</span></span></label>
          </div>
        )}
        {mostraPacotes && (
          <div><div className="flabel">{f.cat === 'ficar' ? 'Pacotes por hora' : 'Pacotes de tempo'} <span className="hint">horas e preço; dê desconto nos maiores</span></div>
            <div className="pkgs">{f.pacotes.map((p, i) => (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <input type="number" min={0.25} step={0.25} value={p.horas} aria-label={`Horas do pacote ${i + 1}`} onChange={(e) => set('pacotes', f.pacotes.map((x, j) => j === i ? { ...x, horas: Number(e.target.value) } : x))} />
                <input type="number" min={0} value={p.preco} aria-label={`Preço do pacote ${i + 1}`} onChange={(e) => set('pacotes', f.pacotes.map((x, j) => j === i ? { ...x, preco: Number(e.target.value) } : x))} />
              </div>
            ))}</div>
            {tipo === 'pacote' && <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={f.porPessoa} onChange={(e) => set('porPessoa', e.target.checked)} /><span>Cobrar por pessoa (espaço compartilhado)</span></label>}
          </div>
        )}
        {tipo === 'diaria' && <label className="check"><input type="checkbox" checked={f.porPessoa} onChange={(e) => set('porPessoa', e.target.checked)} /><span>Cobrar por pessoa{f.sub === 'camping' ? ' (o comum em camping)' : ''}</span></label>}
        {tipo !== 'pacote' && tipo !== 'ingresso' && (
          <div className="grid2">
            <label className="campo">{tipo === 'diaria' ? (f.porPessoa ? 'Diária por pessoa (R$)' : 'Diária (R$)') : 'Preço (R$)'}<input id="a-preco" type="number" min={1} value={f.preco} onChange={(e) => set('preco', Number(e.target.value))} /></label>
            {tipo !== 'diaria' && <label className="campo">Cobrado por<select value={f.unidade} onChange={(e) => set('unidade', e.target.value)}>{(servico ? ['/h', '/visita', '/dia', '/atendimento', '/passeio'] : ['/mês', '']).map((un) => <option key={un} value={un}>{un ? un.slice(1) : 'venda'}</option>)}</select></label>}
          </div>
        )}

        {!servico && tipo !== 'ingresso' && (
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
            {f.acesso !== 'presencial' && <p className="hint" style={{ margin: 0 }}>Sem ninguém no local, depois de {LIMITE_SEM_SUPERVISAO} locações seguidas você confere o espaço antes de liberar novas reservas.</p>}
            <label className="check"><input type="checkbox" checked={f.limpeza} onChange={(e) => set('limpeza', e.target.checked)} /><span>Tenho limpeza depois de cada uso</span></label>
          </>
        )}
        <label className="campo">{servico ? 'Como você trabalha' : tipo === 'ingresso' ? 'Regras do evento (entrada, documentos, o que não pode)' : 'Manual de bons modos'}<textarea rows={3} value={f.manual} onChange={(e) => set('manual', e.target.value)} /></label>
        {servico ? <div className="dica"><p style={{ margin: 0 }}>Você trabalha como freelancer. Depois de 12 h seguidas disponível, seu perfil pausa por 6 h. O cliente paga antes, pelo app; cobrar por fora, em dinheiro ou maquininha, leva à suspensão. A comissão da Celus é de 15% por chamado e você emite nota sobre o que ganhar.</p></div>
          : <div className="dica"><p style={{ margin: 0 }}>Regras da casa: nenhum espaço pode deixar duas pessoas desconhecidas sozinhas num ambiente íntimo fechado; prefira acesso independente. Todo pagamento é feito antes, pelo app, incluindo extras e tempo a mais. Cobrar por fora, em dinheiro ou maquininha, leva à suspensão. Comissão Celus: 15% por reserva.</p></div>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn">{botao}</button>
      </div>
    </form>
  );
}

/* ---------------- Portaria do evento ---------------- */
export function Portaria() {
  const { id } = useParams();
  const a = useDB((d) => d.anuncios.find((x) => x.id === id));
  const reservas = useDB((d) => d.reservas);
  const [cod, setCod] = useState('');
  const [res, setRes] = useState<ReturnType<typeof validarIngresso> | null>(null);
  const [confirmaCancel, setConfirmaCancel] = useState(false);
  if (!a || !a.evento) return <div className="empty">Evento não encontrado.</div>;
  const todos = reservas.filter((r) => r.anuncioId === a.id && r.status !== 'cancelada').flatMap((r) => r.ingressos ?? []);
  const usados = todos.filter((i) => i.usadoEm).length;
  return (
    <>
      <Voltar para="/renda" />
      <h1>Portaria</h1>
      <p className="lead">{a.titulo}, {dataEvento(a.evento.inicio)}. Digite o código do ingresso de cada pessoa. Cada código entra uma vez.</p>
      <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="box kpi"><b className="num">{usados}</b><span>entraram</span></div>
        <div className="box kpi"><b className="num">{todos.length}</b><span>ingressos vendidos</span></div>
      </div>
      <form className="portaria" onSubmit={(e) => { e.preventDefault(); setRes(validarIngresso(a.id, cod)); setCod(''); }}>
        <input id="pt-cod" className="num" autoCapitalize="characters" autoComplete="off" placeholder="CÓDIGO" maxLength={6} value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} aria-label="Código do ingresso" />
        <button className="btn" disabled={cod.length !== 6}>Validar</button>
      </form>
      {res && (res.ok
        ? <div className="alerta ok portaria-res"><b>Pode entrar.</b> {res.nome}, {res.lote}.{res.meia ? ' Meia-entrada: confira o documento.' : ''}</div>
        : <div className="alerta bad portaria-res"><b>Não liberar.</b> {res.erro}</div>)}
      <p className="hint" style={{ marginTop: 14 }}>Confira também o rosto: quem comprou aparece com foto no app.</p>

      <h2>Cancelar o evento</h2>
      {!confirmaCancel ? <button className="btn ghost" onClick={() => setConfirmaCancel(true)}>Cancelar evento e devolver tudo</button>
        : <div className="alerta warn">Todas as pessoas recebem o valor inteiro de volta, incluindo a taxa. Isso não pode ser desfeito.
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { cancelarEvento(a.id); toast('Evento cancelado. Reembolsos enviados'); }}>Cancelar evento</button><button className="btn sm ghost" onClick={() => setConfirmaCancel(false)}>Voltar</button></div></div>}
    </>
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
  const reservas = useDB((d) => d.reservas);
  const usuarios = useDB((d) => d.usuarios);
  if (!u.equipeCelus) return (
    <>
      <h1>Curadoria</h1>
      <p className="lead">Área da equipe Celus: aprova anúncios e decide denúncias. Para testar, ative "Sou da equipe Celus" no seu Perfil.</p>
      <Link className="btn ghost" to="/perfil">Ir para o Perfil</Link>
    </>
  );
  const pend = anuncios.filter((a) => a.status === 'pendente');
  const revisar = anuncios.filter((a) => a.revisar);
  const travadas = reservas.filter((r) => r.codigoTravado);
  const porFora = reservas.filter((r) => r.pagamentoPorFora);
  return (
    <>
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
            <div className="hint">Denunciado por {d.por === 'Usuário' ? 'usuário' : 'anfitrião'}: {d.motivo}. {d.por === 'Usuário' ? 'Oculto até a decisão.' : 'Segue no ar até a decisão.'}</div>
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
            <div className="meta">{CATEGORIAS[a.categoria].nome}, {rotuloPreco(a)}{a.metragemM2 ? `, ${a.metragemM2} m²` : ''}, até {a.capacidade} {a.capacidade > 1 ? 'pessoas' : 'pessoa'}</div>
            <p style={{ fontSize: 14 }}>{a.descricao}</p>
            {a.comodidades.length > 0 && <div className="chips">{a.comodidades.map((c) => <span key={c} className="tag">{COMODIDADES[c]}</span>)}</div>}
            {a.extras.length > 0 && <p className="meta">Extras: {a.extras.map((e) => `${e.nome} ${brl(e.preco)}`).join(', ')}</p>}
            <div className="manual" style={{ marginTop: 8 }}>{a.manualBonsModos}</div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => { decidirAnuncio(a.id, 'aprovado'); toast('Publicado no mapa'); }}>Aprovar</button><button className="btn sm ghost" onClick={() => { decidirAnuncio(a.id, 'recusado'); toast('Anúncio recusado'); }}>Recusar</button></div>
          </div>
        </div>
      ))}</div> : <div className="empty">Fila vazia.</div>}
      {porFora.length > 0 && (
        <>
          <h2>Pedidos de pagamento por fora</h2>
          <div className="stack">{porFora.map((r) => (
            <div key={r.id} className="box" style={{ padding: 14 }}>
              <b>{anuncios.find((a) => a.id === r.anuncioId)?.titulo}</b>
              <div className="meta">Avisado por {usuarios[r.userId]?.nome ?? 'cliente'}.</div>
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { arquivarPorFora(r.id, true); toast('Anúncio pausado'); }}>Pausar anúncio</button><button className="btn sm ghost" onClick={() => { arquivarPorFora(r.id, false); toast('Aviso arquivado'); }}>Arquivar</button></div>
            </div>
          ))}</div>
        </>
      )}
      {travadas.length > 0 && (
        <>
          <h2>Códigos de chegada travados</h2>
          <div className="stack">{travadas.map((r) => (
            <div key={r.id} className="box" style={{ padding: 14 }}>
              <b>{anuncios.find((a) => a.id === r.anuncioId)?.titulo}</b>
              <div className="meta">Cliente: {usuarios[r.userId]?.nome ?? 'desconhecido'}. {r.tentativasCodigo} tentativas erradas.</div>
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { destravarCodigo(r.id); toast('Conferência liberada'); }}>Falei com as duas partes, liberar</button>
            </div>
          ))}</div>
        </>
      )}
      {revisar.length > 0 && (
        <>
          <h2>Mudanças em anúncios no ar</h2>
          <div className="stack">{revisar.map((a) => (
            <div key={a.id} className="box" style={{ overflow: 'hidden' }}>
              <Miniatura a={a} grande />
              <div style={{ padding: 14 }}>
                <b>{a.titulo}</b>
                <p style={{ fontSize: 14 }}>{a.descricao}</p>
                <div className="row"><button className="btn sm" onClick={() => { conferirRevisao(a.id, true); toast('Mudanças aprovadas'); }}>Aprovar mudanças</button><button className="btn sm ghost" onClick={() => { conferirRevisao(a.id, false); toast('Anúncio pausado'); }}>Pausar anúncio</button></div>
              </div>
            </div>
          ))}</div>
        </>
      )}
    </>
  );
}
