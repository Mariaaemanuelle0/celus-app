import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { destinoDepoisDeEntrar } from '../components/Layout';
import { Marca } from '../components/Layout';
import { IconeCategoria } from '../components/ui';
import { CATEGORIAS } from '../data/catalogo';
import type { Categoria } from '../data/types';
import { lerImagem } from '../components/ui';
import { cadastrar, entrar, enviarDocumento } from '../store/acoes';
import { esqueciSenha, noServidor, trocarSenha } from '../store/conta';
import { useUsuario } from '../store/db';

type Tela = 'inicio' | 'cadastro' | 'entrar' | 'menor' | 'senha' | 'confirmar' | 'enviado';

export function Entrar() {
  const [tela, setTela] = useState<Tela>('inicio');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState({ nome: '', email: '', senha: '', nascimento: '', aceite: false });
  const nav = useNavigate();

  async function onCadastro(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    const r = await cadastrar(f);
    setEnviando(false);
    if (r.ok) return r.confirmar ? setTela('confirmar') : nav('/verificar');
    if (r.erro === 'menor') return setTela('menor');
    setErro(r.erro);
  }
  async function onEntrar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    const r = await entrar(f.email, f.senha);
    setEnviando(false);
    if (r.ok) nav(destinoDepoisDeEntrar()); else setErro(r.erro);
  }
  async function onEsqueci(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    const r = await esqueciSenha(f.email);
    setEnviando(false);
    if (r.ok) setTela('enviado'); else setErro(r.erro);
  }
  const campo = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="shell"><div className="app entrada">
      <div className="entrada-topo"><Marca /><span>Celus</span></div>

      {tela === 'inicio' && (
        <div className="entrada-inicio">
          <Radar />
          <h1 className="entrada-h1">Espaços e serviços por perto, na hora que você precisa.</h1>
          <p className="lead">Banho, descanso, lugar para trabalhar, estacionamento, estadia, evento e profissionais. Tudo num mapa.</p>
          <div className="stack" style={{ gap: 10, marginTop: 8 }}>
            <button className="btn" onClick={() => setTela('cadastro')}>Criar conta</button>
            <button className="btn ghost" onClick={() => setTela('entrar')}>Já tenho conta</button>
          </div>
          <p className="hint" style={{ textAlign: 'center', marginTop: 4 }}>Só para maiores de 18 anos.</p>
        </div>
      )}

      {tela === 'cadastro' && (
        <form className="stack" onSubmit={onCadastro} noValidate>
          <h1>Criar conta</h1>
          <label className="campo">Nome completo<input id="c-nome" autoComplete="name" value={f.nome} onChange={campo('nome')} /></label>
          <label className="campo">E-mail<input id="c-email" type="email" autoComplete="email" value={f.email} onChange={campo('email')} /></label>
          <label className="campo">Senha<input id="c-senha" type="password" autoComplete="new-password" value={f.senha} onChange={campo('senha')} /><span className="hint">Pelo menos 8 caracteres.</span></label>
          <label className="campo">Data de nascimento<input id="c-nasc" type="date" value={f.nascimento} onChange={campo('nascimento')} max={new Date().toISOString().slice(0, 10)} /></label>
          <label className="check"><input id="c-aceite" type="checkbox" checked={f.aceite} onChange={(e) => setF({ ...f, aceite: e.target.checked })} />
            <span>Li e aceito os termos de uso e a política de privacidade, e confirmo que tenho 18 anos ou mais.</span></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn" disabled={enviando}>Continuar</button>
          <button type="button" className="back" onClick={() => { setErro(''); setTela('entrar'); }}>Já tenho conta</button>
        </form>
      )}

      {tela === 'entrar' && (
        <form className="stack" onSubmit={onEntrar} noValidate>
          <h1>Entrar</h1>
          <label className="campo">E-mail<input id="e-email" type="email" autoComplete="email" value={f.email} onChange={campo('email')} /></label>
          <label className="campo">Senha<input id="e-senha" type="password" autoComplete="current-password" value={f.senha} onChange={campo('senha')} /></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn" disabled={enviando}>Entrar</button>
          <div className="row"><button type="button" className="back sp" style={{ textAlign: 'left' }} onClick={() => { setErro(''); setTela('cadastro'); }}>Criar conta</button>
            <button type="button" className="back" onClick={() => { setErro(''); setTela('senha'); }}>Esqueci minha senha</button></div>
        </form>
      )}

      {tela === 'confirmar' && (
        <div className="stack">
          <h1>Confira seu e-mail</h1>
          <p className="lead">Mandamos um link para <b>{f.email}</b>. Toque nele para ativar sua conta e depois entre com sua senha.</p>
          <p className="hint">Não chegou? Veja a caixa de spam ou lixo eletrônico.</p>
          <button className="btn ghost" onClick={() => setTela('entrar')}>Já confirmei, quero entrar</button>
        </div>
      )}

      {tela === 'senha' && noServidor && (
        <form className="stack" onSubmit={onEsqueci} noValidate>
          <h1>Esqueci minha senha</h1>
          <p className="lead">Digite seu e-mail. Mandamos um link para você criar uma senha nova.</p>
          <label className="campo">E-mail<input id="s-email" type="email" autoComplete="email" value={f.email} onChange={campo('email')} /></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn" disabled={enviando || !f.email}>Enviar link</button>
          <button type="button" className="back" onClick={() => { setErro(''); setTela('entrar'); }}>Voltar para entrar</button>
        </form>
      )}

      {tela === 'enviado' && (
        <div className="stack">
          <h1>Link enviado</h1>
          <p className="lead">Se existir uma conta com <b>{f.email}</b>, o link para criar uma senha nova chega em alguns minutos.</p>
          <button className="btn ghost" onClick={() => setTela('entrar')}>Voltar para entrar</button>
        </div>
      )}

      {tela === 'senha' && !noServidor && (
        <div className="stack">
          <h1>Esqueci minha senha</h1>
          <p className="lead">Quando o servidor da Celus estiver ligado, você digita seu e-mail aqui e recebe um link para criar uma senha nova.</p>
          <div className="alerta warn">No modo demonstração ainda não enviamos e-mail. Para testar de novo, crie uma conta com outro e-mail ou apague os dados de teste no Perfil.</div>
          <button className="btn ghost" onClick={() => setTela('entrar')}>Voltar para entrar</button>
        </div>
      )}

      {tela === 'menor' && (
        <div className="stack">
          <h1>O Celus é só para maiores de 18 anos</h1>
          <p className="lead">Pela data de nascimento informada, não é possível criar uma conta agora. Nenhum dado seu foi guardado.</p>
          <button className="btn ghost" onClick={() => { setF({ nome: '', email: '', senha: '', nascimento: '', aceite: false }); setTela('inicio'); }}>Voltar ao início</button>
        </div>
      )}
      {!noServidor && <p className="demo-aviso">Modo demonstração: sua conta fica salva só neste aparelho até o banco de dados ser ligado.</p>}
    </div></div>
  );
}

export function Verificar() {
  const u = useUsuario();
  const nav = useNavigate();
  const [doc, setDoc] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  if (!u) return null;
  const enviar = async () => {
    setErro(''); setEnviando(true);
    const r = await enviarDocumento(doc!, selfie!);
    setEnviando(false);
    if (r.ok) nav(destinoDepoisDeEntrar()); else setErro(r.erro);
  };
  if (u.verificacao === 'em_analise') return (
    <div className="shell"><div className="app entrada">
      <div className="entrada-topo"><Marca /><span>Celus</span></div>
      <div className="stack">
        <h1>Identidade em análise</h1>
        <p className="lead">Recebemos seu documento e sua selfie. A equipe Celus confere e você recebe a liberação aqui no app. Enquanto isso, já dá para explorar o mapa.</p>
        <button className="btn" onClick={() => nav(destinoDepoisDeEntrar())}>Abrir o mapa</button>
      </div>
    </div></div>
  );
  const ler = (set: (s: string) => void) => async (e: { target: HTMLInputElement }) => { const file = e.target.files?.[0]; if (file) set(await lerImagem(file)); };
  return (
    <div className="shell"><div className="app entrada">
      <div className="entrada-topo"><Marca /><span>Celus</span></div>
      <div className="stack">
                <h1>Confirme sua identidade</h1>
        <p className="lead">É o que garante que todo mundo na Celus é real e maior de idade. A selfie vira sua foto de perfil: quem recebe você confere que é você. Libera reservas, chat, stories e o Ficar.</p>
        <label className="upload">{doc ? <img src={doc} alt="Documento enviado" /> : <span>Foto do documento (RG ou CNH)</span>}<input id="v-doc" type="file" accept="image/*" capture="environment" onChange={ler(setDoc)} /></label>
        <label className="upload">{selfie ? <img src={selfie} alt="Selfie enviada" /> : <span>Selfie do seu rosto<br /><small className="hint">Vira sua foto de perfil. Sem óculos escuros, boné ou filtro.</small></span>}<input id="v-selfie" type="file" accept="image/*" capture="user" onChange={ler(setSelfie)} /></label>
        {u.verificacao === 'recusado' && <div className="alerta warn">Não conseguimos confirmar sua identidade. Envie fotos novas, com boa luz e o documento inteiro aparecendo.</div>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn" disabled={!doc || !selfie || enviando} onClick={enviar}>{enviando ? 'Enviando...' : 'Enviar para verificação'}</button>
        <button className="btn ghost" onClick={() => nav(destinoDepoisDeEntrar())}>Fazer depois</button>
        <p className="hint">{noServidor ? 'O documento fica guardado com acesso restrito à equipe Celus, só para conferir que é você.' : 'No modo demonstração a verificação é aprovada na hora e as fotos não saem do aparelho. No app real, um serviço especializado confere documento e rosto.'}</p>
      </div>
    </div></div>
  );
}

/** Aberta pelo link do e-mail de "Esqueci minha senha". */
export function NovaSenha() {
  const nav = useNavigate();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  return (
    <div className="shell"><div className="app entrada">
      <div className="entrada-topo"><Marca /><span>Celus</span></div>
      {ok ? (
        <div className="stack"><h1>Senha nova salva</h1><button className="btn" onClick={() => nav('/')}>Abrir o app</button></div>
      ) : (
        <form className="stack" noValidate onSubmit={async (e) => { e.preventDefault(); const r = await trocarSenha(senha); if (r.ok) setOk(true); else setErro(r.erro); }}>
          <h1>Crie uma senha nova</h1>
          <label className="campo">Senha nova<input id="n-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /><span className="hint">Pelo menos 8 caracteres.</span></label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn" disabled={senha.length < 8}>Salvar senha</button>
        </form>
      )}
    </div></div>
  );
}

/**
 * Ilustração de abertura: o polvo da Celus no centro, com os tentáculos ondulando
 * e as oito categorias saindo dele (oito braços, oito jeitos de resolver o dia).
 * A ondulação é um filtro de distorção aplicado só aos tentáculos; a cabeça fica parada.
 */
function Radar() {
  const C = { x: 170, y: 150 }, R = 118, P = 132; // centro, raio das categorias, tamanho do polvo
  const ordem: Categoria[] = ['banheiro', 'trabalho', 'descanso', 'ficar', 'servicos', 'eventos', 'estacionamento', 'imoveis'];
  const pontos = ordem.map((c, i) => {
    const ang = (-90 + i * 45) * (Math.PI / 180);
    return { c, x: C.x + R * Math.cos(ang), y: C.y + R * Math.sin(ang), i };
  });
  const ox = C.x - P / 2, oy = C.y - P / 2 + 4;
  return (
    <div className="radar" aria-hidden="true">
      <svg viewBox="0 0 340 300" width="100%">
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#4C8DFF" stopOpacity=".24" /><stop offset="1" stopColor="#4C8DFF" stopOpacity="0" /></radialGradient>
          <filter id="ondas" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="7" result="ruido">
              <animate attributeName="baseFrequency" dur="7s" values="0.018 0.03;0.024 0.036;0.016 0.026;0.018 0.03" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="ruido" scale="9" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Cabeça parada, tentáculos ondulando: as duas máscaras se completam. */}
          <radialGradient id="cab" cx={ox + P * 0.42} cy={oy + P * 0.27} r={P * 0.3} gradientUnits="userSpaceOnUse">
            <stop offset=".72" stopColor="#fff" /><stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="tent" cx={ox + P * 0.42} cy={oy + P * 0.27} r={P * 0.3} gradientUnits="userSpaceOnUse">
            <stop offset=".72" stopColor="#000" /><stop offset="1" stopColor="#fff" />
          </radialGradient>
          <mask id="m-cab"><rect x="0" y="0" width="340" height="300" fill="url(#cab)" /></mask>
          <mask id="m-tent"><rect x="0" y="0" width="340" height="300" fill="url(#tent)" /></mask>
        </defs>
        <circle cx={C.x} cy={C.y} r={R + 12} fill="url(#rg)" />
        {[50, R].map((r) => <circle key={r} cx={C.x} cy={C.y} r={r} fill="none" stroke="#4C8DFF" strokeOpacity={r === R ? 0.4 : 0.16} strokeDasharray={r === R ? '2 6' : undefined} />)}
        {pontos.map((p) => (
          <line key={p.c} className="braco" x1={C.x} y1={C.y} x2={p.x} y2={p.y} style={{ animationDelay: `${0.5 + p.i * 0.12}s`, color: CATEGORIAS[p.c].cor }} />
        ))}
        <g className="polvo-flutua">
          <image href="/polvo.png" x={ox} y={oy} width={P} height={P} mask="url(#m-cab)" />
          <image href="/polvo.png" x={ox} y={oy} width={P} height={P} mask="url(#m-tent)" filter="url(#ondas)" />
        </g>
        {pontos.map((p) => (
          <g key={p.c} transform={`translate(${p.x - 17} ${p.y - 17})`}>
            <g className="sai" style={{ ['--dx' as string]: `${C.x - p.x}px`, ['--dy' as string]: `${C.y - p.y}px`, animationDelay: `${0.5 + p.i * 0.12}s` }}>
              <g className="boia" style={{ animationDelay: `${p.i * -0.7}s`, color: CATEGORIAS[p.c].cor }}>
                <rect width="34" height="34" rx="11" fill="#0A1120" stroke="currentColor" strokeOpacity=".6" />
                <g transform="translate(8 8)"><IconeCategoria c={p.c} tamanho={18} /></g>
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
