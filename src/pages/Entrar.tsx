import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Marca } from '../components/Layout';
import { IconeCategoria } from '../components/ui';
import { CATEGORIAS } from '../data/catalogo';
import type { Categoria } from '../data/types';
import { lerImagem } from '../components/ui';
import { cadastrar, entrar, enviarDocumento } from '../store/acoes';
import { useUsuario } from '../store/db';

type Tela = 'inicio' | 'cadastro' | 'entrar' | 'menor';

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
    if (r.ok) return nav('/verificar');
    if (r.erro === 'menor') return setTela('menor');
    setErro(r.erro);
  }
  async function onEntrar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true);
    const r = await entrar(f.email, f.senha);
    setEnviando(false);
    if (r.ok) nav('/'); else setErro(r.erro);
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
          <button type="button" className="back" onClick={() => { setErro(''); setTela('cadastro'); }}>Criar conta</button>
        </form>
      )}

      {tela === 'menor' && (
        <div className="stack">
          <h1>O Celus é só para maiores de 18 anos</h1>
          <p className="lead">Pela data de nascimento informada, não é possível criar uma conta agora. Nenhum dado seu foi guardado.</p>
          <button className="btn ghost" onClick={() => { setF({ nome: '', email: '', senha: '', nascimento: '', aceite: false }); setTela('inicio'); }}>Voltar ao início</button>
        </div>
      )}
      <p className="demo-aviso">Modo demonstração: sua conta fica salva só neste aparelho até o banco de dados ser ligado.</p>
    </div></div>
  );
}

export function Verificar() {
  const u = useUsuario();
  const nav = useNavigate();
  const [doc, setDoc] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  if (!u) return null;
  const ler = (set: (s: string) => void) => async (e: { target: HTMLInputElement }) => { const file = e.target.files?.[0]; if (file) set(await lerImagem(file)); };
  return (
    <div className="shell"><div className="app entrada">
      <div className="entrada-topo"><Marca /><span>Celus</span></div>
      <div className="stack">
                <h1>Confirme sua identidade</h1>
        <p className="lead">É o que garante que todo mundo no Celus é real e maior de idade. Libera o chat, os stories e as categorias de estadia.</p>
        <label className="upload">{doc ? <img src={doc} alt="Documento enviado" /> : <span>Foto do documento (RG ou CNH)</span>}<input id="v-doc" type="file" accept="image/*" capture="environment" onChange={ler(setDoc)} /></label>
        <label className="upload">{selfie ? <img src={selfie} alt="Selfie enviada" /> : <span>Selfie segurando o documento</span>}<input id="v-selfie" type="file" accept="image/*" capture="user" onChange={ler(setSelfie)} /></label>
        <button className="btn" disabled={!doc || !selfie} onClick={() => { enviarDocumento(); nav('/'); }}>Enviar para verificação</button>
        <button className="btn ghost" onClick={() => nav('/')}>Fazer depois</button>
        <p className="hint">No modo demonstração a verificação é aprovada na hora e as fotos não saem do aparelho. No app real, um serviço especializado confere documento e rosto.</p>
      </div>
    </div></div>
  );
}

/** Ilustração de abertura: o raio de busca com lugares em volta de você. */
function Radar() {
  const pontos: [Categoria, number, number][] = [
    ['banheiro', 92, 70], ['trabalho', 232, 58], ['descanso', 268, 150], ['estacionamento', 58, 168],
    ['servicos', 196, 222], ['eventos', 120, 236], ['ficar', 290, 236],
  ];
  return (
    <div className="radar" aria-hidden="true">
      <svg viewBox="0 0 340 280" width="100%">
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#4C8DFF" stopOpacity=".22" /><stop offset="1" stopColor="#4C8DFF" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="170" cy="145" r="128" fill="url(#rg)" />
        {[44, 86, 128].map((r) => <circle key={r} cx="170" cy="145" r={r} fill="none" stroke="#4C8DFF" strokeOpacity={r === 128 ? 0.55 : 0.2} strokeDasharray={r === 128 ? '2 6' : undefined} />)}
        <circle cx="170" cy="145" r="7" fill="#4C8DFF" stroke="#fff" strokeWidth="2.5" />
        {pontos.map(([c, x, y]) => (
          <g key={c} transform={`translate(${x - 17} ${y - 17})`} style={{ color: CATEGORIAS[c].cor }}>
            <rect width="34" height="34" rx="11" fill="#0A1120" stroke="currentColor" strokeOpacity=".55" />
            <g transform="translate(8 8)"><IconeCategoria c={c} tamanho={18} /></g>
          </g>
        ))}
      </svg>
    </div>
  );
}
