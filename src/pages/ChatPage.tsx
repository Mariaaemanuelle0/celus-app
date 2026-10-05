import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast, useAgora, useLocalizacao } from '../components/ui';
import { centroPiloto } from '../lib/geo';
import { CHAT_MS, quadranteChat } from '../lib/regras';
import { enviarMensagem, ocultarMensagem } from '../store/acoes';
import { mudar, novoId, useDB, useUsuario } from '../store/db';

const REGRAS = [
  'Todo mundo aparece com nome e perfil verificado. Não existe anônimo.',
  'Somente maiores de 18 anos com documento verificado.',
  'Palavrão, telefone, e-mail e link são bloqueados automaticamente.',
  'Cada mensagem some sozinha em até 10 minutos.',
  'Sua localização exata nunca aparece. A sala mostra só a região.',
];

export function ChatPage() {
  const u = useUsuario()!;
  const agora = useAgora(1000);
  const onde = useLocalizacao() ?? centroPiloto();
  const quad = quadranteChat(onde);
  const todas = useDB((d) => d.chat);
  const [entrou, setEntrou] = useState(false);
  const [txt, setTxt] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const msgs = todas.filter((m) => m.quad === quad && agora - m.t < CHAT_MS);

  // Modo demonstração: coloca duas mensagens de exemplo quando a sala está vazia.
  useEffect(() => {
    if (!entrou || msgs.length) return;
    mudar((d) => {
      const t = Date.now();
      d.chat.push({ id: novoId(), quad, autorId: 'demo-1', autorNome: 'Júlia', t: t - 4 * 60_000, txt: 'Alguém sabe se o vestiário daqui está com fila?' });
      d.chat.push({ id: novoId(), quad, autorId: 'demo-2', autorNome: 'Carol', t: t - 2 * 60_000, txt: 'Está tranquilo, acabei de sair de lá.' });
    });
  }, [entrou]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  if (u.verificacao !== 'verificado') return (
    <>
      <div className="eyebrow">Chat da região</div>
      <h1>Verifique seu documento para entrar</h1>
      <p className="lead">O chat é uma sala aberta com quem está perto. Por segurança, só entra quem tem 18 anos ou mais e documento verificado.</p>
      <Link className="btn" to="/verificar">Verificar agora</Link>
    </>
  );

  if (!entrou) return (
    <>
      <div className="eyebrow">Chat da região</div>
      <h1>Sala de quem está perto de você</h1>
      <div className="box" style={{ padding: 16 }}>
        <b>Antes de entrar</b>
        <ol className="regras">{REGRAS.map((r) => <li key={r}>{r}</li>)}</ol>
        <button className="btn" onClick={() => setEntrou(true)}>Entendi, entrar na sala</button>
      </div>
    </>
  );

  function enviar(e: FormEvent) {
    e.preventDefault();
    const r = enviarMensagem(quad, txt);
    if (r.ok) setTxt(''); else if (r.erro) toast(r.erro);
  }
  const falta = (t: number) => { const s = Math.max(0, Math.round((t + CHAT_MS - agora) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  return (
    <>
      <div className="eyebrow">Chat da região</div>
      <h1 style={{ marginBottom: 2 }}>Sala da sua região</h1>
      <div className="meta"><span className="dotlive" />Mensagens somem em 10 min</div>
      <div className="chatlist">
        {msgs.length ? msgs.map((m) => {
          const minha = m.autorId === u.id;
          return (
            <div key={m.id} className={`msg ${minha ? 'mine' : ''}`}>
              {!minha && <span className="pav">{m.autorNome.slice(0, 1)}</span>}
              <div className="bub">
                <div className="mh"><b>{minha ? 'Você' : m.autorNome}</b><span className="num">some em {falta(m.t)}</span>
                  {!minha && <button className="mden" onClick={() => { ocultarMensagem(m.id); toast('Mensagem ocultada e enviada para a curadoria'); }}>Denunciar</button>}</div>
                <div>{m.txt}</div>
              </div>
            </div>
          );
        }) : <div className="empty">Sala tranquila. Seja a primeira pessoa a falar.</div>}
        <div ref={fim} />
      </div>
      <form className="chatbar" onSubmit={enviar}>
        <input id="chat-msg" maxLength={200} placeholder="Mensagem para a região" autoComplete="off" value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Mensagem" />
        <button className="btn sm">Enviar</button>
      </form>
    </>
  );
}
