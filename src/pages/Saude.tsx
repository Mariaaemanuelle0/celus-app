import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Moeda, Voltar, toast, useAgora, useLocalizacao } from '../components/ui';
import { centroPiloto, distanciaKm, formatarDistancia, type Ponto } from '../lib/geo';
import { GANHOS, JANELA_QR_S, TIPOS_SAUDE, codigoQR, janelaAtual } from '../lib/regras';
import { cadastrarLocalSaude, checkinSaude, pausarLocalSaude, progressoSaude, type ResultadoTreino } from '../store/acoes';
import { useDB, useUsuario } from '../store/db';
import type { TipoSaude } from '../data/types';

const v = (chave: string) => GANHOS.find((g) => g.chave === chave)?.v ?? 0;

/** Pega a posição uma vez (para o check-in). */
function posicaoAgora(): Promise<Ponto | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), () => ok(null), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 20_000 });
  });
}

function Progresso({ feitos, meta, rotulo }: { feitos: number; meta: number; rotulo: string }) {
  return (
    <div className="prog">
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="hint">{rotulo}</span><span className="num">{Math.min(feitos, meta)}/{meta}</span></div>
      <div className="prog-barra" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={Math.min(feitos, meta)}><span style={{ width: `${Math.min(100, (feitos / meta) * 100)}%` }} /></div>
    </div>
  );
}

/** Cartão que aparece no Perfil. */
export function CartaoSaude() {
  const u = useUsuario()!;
  const checkins = useDB((d) => d.checkinsSaude);
  const p = useMemo(() => progressoSaude({ checkinsSaude: checkins }, u.id), [checkins, u.id]);
  return (
    <Link to="/saude" className="box saude-card">
      <span className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span><b>Saúde</b><span className="hint" style={{ display: 'block' }}>{p.hoje ? 'Treino de hoje registrado' : `Treinou? Escaneie o QR da recepção e ganhe ${v('treino')} celus`}</span></span>
        <span className="entrada-ic saude-cor" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></span>
      </span>
      <Progresso feitos={p.semana} meta={3} rotulo="Esta semana" />
    </Link>
  );
}

function Resultado({ r }: { r: ResultadoTreino }) {
  if (!r.ok) return <div className="alerta bad" style={{ marginTop: 14 }}>{r.erro}</div>;
  return (
    <div className="box treino-ok" style={{ marginTop: 14 }}>
      <b>Treino registrado: {r.local}</b>
      {r.ganho > 0 && <div className="row" style={{ marginTop: 6 }}><Moeda tamanho={18} /><span className="num" style={{ fontSize: 22 }}>+{r.ganho}</span><span className="hint">celus</span></div>}
      {r.bonus.map((b) => <div key={b} className="hint" style={{ color: 'var(--ok)' }}>Bônus de constância: {b}</div>)}
    </div>
  );
}

/** Tela de quem treina: progresso, parceiros por perto e check-in. */
export function SaudePage() {
  const u = useUsuario()!;
  const onde = useLocalizacao() ?? centroPiloto();
  const locais = useDB((d) => d.locaisSaude);
  const checkins = useDB((d) => d.checkinsSaude);
  const p = useMemo(() => progressoSaude({ checkinsSaude: checkins }, u.id), [checkins, u.id]);
  const meus = useMemo(() => checkins.filter((c) => c.userId === u.id).sort((a, b) => b.t - a.t).slice(0, 8), [checkins, u.id]);
  const perto = useMemo(() => locais.filter((l) => l.status === 'aprovado').map((l) => ({ l, d: distanciaKm(onde, l) })).sort((a, b) => a.d - b.d), [locais, onde]);
  const [digitar, setDigitar] = useState<string | null>(null);
  const [cod, setCod] = useState('');
  const [res, setRes] = useState<ResultadoTreino | null>(null);
  const nome = (id: string) => locais.find((l) => l.id === id)?.nome ?? 'Parceiro';
  const fazer = async (localId: string, codigo: string, demo = false) => { const r = checkinSaude(localId, codigo, demo ? null : await posicaoAgora(), demo); setRes(r); if (r.ok) { setDigitar(null); setCod(''); } };
  return (
    <>
      <Voltar para="/perfil" />
      <h1>Saúde</h1>
      <p className="lead">Treinou, ganhou. Nos parceiros Celus, escaneie o QR da recepção com a câmera do celular.</p>
      <div className="box" style={{ padding: 16 }}>
        <Progresso feitos={p.semana} meta={3} rotulo={`Esta semana. Com 3 treinos, +${v('semana3')} celus`} />
        <Progresso feitos={p.mes} meta={12} rotulo={`Este mês. Com 12 treinos, +${v('mes12')} celus`} />
        <p className="hint" style={{ margin: '10px 0 0' }}>Cada treino vale {v('treino')} celus, um por dia. Sua frequência não aparece no seu perfil público.</p>
      </div>
      {res && <Resultado r={res} />}

      <h2>Parceiros perto de você</h2>
      {perto.length ? <div className="stack">{perto.map(({ l, d }) => (
        <div key={l.id} className="box parceiro">
          <div><b>{l.nome}</b><div className="hint">{TIPOS_SAUDE[l.tipo]}, {l.bairro}, a {formatarDistancia(d)}</div></div>
          {digitar === l.id ? (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id={`sd-${l.id}`} className="sp num" inputMode="numeric" maxLength={6} placeholder="000000" value={cod} onChange={(e) => setCod(e.target.value.replace(/\D/g, ''))} aria-label="Código da recepção" />
              <button className="btn sm" disabled={cod.length !== 6} onClick={() => fazer(l.id, cod)}>Registrar</button>
            </div>
          ) : (
            <span className="row" style={{ gap: 8 }}>
              <button className="btn sm ghost" onClick={() => { setDigitar(l.id); setCod(''); }}>Digitar código</button>
              {l.donoId.startsWith('demo-') && <button className="btn sm" onClick={() => fazer(l.id, '', true)}>Simular QR (teste)</button>}
            </span>
          )}
        </div>
      ))}</div> : <div className="empty">Ainda não há parceiros de saúde por aqui.</div>}

      {meus.length > 0 && <><h2>Seus treinos</h2><div className="box" style={{ padding: '4px 14px' }}>{meus.map((c) => <div key={c.id} className="sumline"><span>{nome(c.localId)}</span><span className="hint">{new Date(c.t).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span></div>)}</div></>}
      <p className="hint" style={{ marginTop: 16 }}>Tem academia, estúdio ou box? Cadastre em Rentabilizar e ofereça celus para seus alunos voltarem mais.</p>
    </>
  );
}

/** Aberto pela câmera do celular a partir do QR da recepção. */
export function CheckinTreino() {
  const [q] = useSearchParams();
  const l = q.get('l') ?? '', c = q.get('c') ?? '';
  const [res, setRes] = useState<ResultadoTreino | null>(null);
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return; feito.current = true;
    posicaoAgora().then((onde) => setRes(checkinSaude(l, c, onde)));
  }, [l, c]);
  return (
    <>
      <h1>Check-in de treino</h1>
      {!res ? <p className="lead">Confirmando que você está no local...</p> : <Resultado r={res} />}
      <Link className="btn ghost" style={{ marginTop: 16 }} to="/saude">Ver meu progresso</Link>
    </>
  );
}

/** Lado do parceiro: cadastro do local e a tela do QR para deixar na recepção. */
export function PainelSaude() {
  const u = useUsuario()!;
  const local = useDB((d) => d.locaisSaude.find((l) => l.donoId === u.id && l.status !== 'recusado'));
  const checkins = useDB((d) => d.checkinsSaude);
  if (!local) return <CadastroSaude />;
  const hoje = new Date().toLocaleDateString('sv-SE');
  const doLocal = checkins.filter((c) => c.localId === local.id);
  const nHoje = doLocal.filter((c) => new Date(c.t).toLocaleDateString('sv-SE') === hoje).length;
  const n7 = doLocal.filter((c) => Date.now() - c.t < 7 * 86_400_000).length;
  return (
    <>
      <Voltar para="/renda" />
      <h1>{local.nome}</h1>
      <p className="meta">{TIPOS_SAUDE[local.tipo]}, {local.bairro}</p>
      {local.status === 'pendente' && <div className="alerta warn" style={{ marginTop: 12 }}>Em análise pela curadoria. Quando aprovar, o QR aparece aqui.</div>}
      {local.status === 'pausado' && <div className="alerta warn" style={{ marginTop: 12 }}>Check-in pausado. Ninguém ganha celus aqui até você reativar.</div>}
      {local.status === 'aprovado' && <TelaQR segredo={local.segredo} localId={local.id} />}
      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="box kpi"><b className="num">{nHoje}</b><span>Treinos hoje</span></div>
        <div className="box kpi"><b className="num">{n7}</b><span>Últimos 7 dias</span></div>
        <div className="box kpi"><b className="num">{new Set(doLocal.map((c) => c.userId)).size}</b><span>Pessoas</span></div>
      </div>
      <h2>Como usar</h2>
      <ol className="etapas">
        <li><b>Deixe esta tela aberta na recepção</b><span>Num tablet ou celular, virado para quem chega.</span></li>
        <li><b>O aluno aponta a câmera para o QR</b><span>O código muda a cada {JANELA_QR_S} segundos, então foto do QR não funciona.</span></li>
        <li><b>Ele ganha celus por treinar</b><span>Só vale com a pessoa dentro do local e uma vez por dia.</span></li>
      </ol>
      {local.status !== 'pendente' && <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => pausarLocalSaude(local.id)}>{local.status === 'pausado' ? 'Reativar check-in' : 'Pausar check-in'}</button>}
    </>
  );
}

function TelaQR({ segredo, localId }: { segredo: string; localId: string }) {
  const agora = useAgora(1000);
  const janela = janelaAtual(agora);
  const codigo = codigoQR(segredo, janela);
  const resta = JANELA_QR_S - Math.floor((agora / 1000) % JANELA_QR_S);
  const [svg, setSvg] = useState('');
  useEffect(() => {
    const url = `${location.origin}/saude/checkin?l=${encodeURIComponent(localId)}&c=${codigo}`;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#05070C', light: '#FFFFFF' } }).then(setSvg).catch(() => setSvg(''));
  }, [codigo, localId]);
  return (
    <div className="qr-tela">
      <div className="qr" aria-label="QR de check-in" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="num qr-cod" aria-label="Código">{codigo.slice(0, 3)} {codigo.slice(3)}</div>
      <div className="hint">Muda em {resta} s. Treinou? Escaneie e ganhe celus.</div>
    </div>
  );
}

function CadastroSaude() {
  const onde = useLocalizacao() ?? centroPiloto();
  const [f, setF] = useState({ nome: '', tipo: 'academia' as TipoSaude, bairro: '' });
  const [erro, setErro] = useState('');
  return (
    <>
      <Voltar para="/renda" />
      <h1>Parceiro de saúde</h1>
      <p className="lead">Academias, estúdios e boxes oferecem celus para quem treina. Seus alunos voltam mais, e quem está perto encontra você no app.</p>
      <div className="stack">
        <label className="campo">Nome do local<input id="ls-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Academia Fôlego" /></label>
        <div className="grid2">
          <label className="campo">Tipo<select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoSaude })}>{Object.entries(TIPOS_SAUDE).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <label className="campo">Bairro<input id="ls-bairro" value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} placeholder="Enseada" /></label>
        </div>
        <p className="hint">Faça o cadastro de dentro do local: usamos a sua localização agora para conferir os check-ins. A curadoria confere antes de liberar.</p>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn" onClick={() => { const r = cadastrarLocalSaude({ ...f, lat: onde.lat, lng: onde.lng }); if (r.ok) toast('Enviado para a curadoria'); else setErro(r.erro); }}>Enviar para aprovação</button>
      </div>
    </>
  );
}
