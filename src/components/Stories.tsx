import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CATEGORIAS } from '../data/catalogo';
import type { Story } from '../data/types';
import { STORY_MS } from '../lib/regras';
import { denunciarStory } from '../store/acoes';
import { useDB } from '../store/db';
import { toast } from './ui';

const MOTIVOS = ['Mostra pessoa sem autorização', 'Aparece criança', 'Conteúdo impróprio', 'Não foi feito neste local', 'Propaganda ou spam'];
const ha = (t: number) => { const m = Math.max(1, Math.round((Date.now() - t) / 60_000)); return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`; };
const falta = (t: number) => { const m = Math.max(0, Math.round((t + STORY_MS - Date.now()) / 60_000)); return m < 60 ? `some em ${m} min` : `some em ${Math.floor(m / 60)} h ${m % 60} min`; };

export function StoryRing({ lista, rotulo, cor }: { lista: Story[]; rotulo: string; cor: string }) {
  const [aberto, setAberto] = useState(false);
  const ultimo = lista[lista.length - 1];
  return (
    <>
      <button className="sto" onClick={() => setAberto(true)} aria-label={`Ver stories: ${rotulo}`}>
        <span className="ring"><span className="in" style={{ ['--c' as string]: cor, ...(ultimo?.img ? { backgroundImage: `url(${ultimo.img})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}>{!ultimo?.img && <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{ultimo?.autorNome.slice(0, 1)}</b>}</span></span>
        <span className="n">{rotulo}</span>
      </button>
      {aberto && <Visualizador lista={lista} fechar={() => setAberto(false)} />}
    </>
  );
}

export function Visualizador({ lista, fechar }: { lista: Story[]; fechar: () => void }) {
  const [i, setI] = useState(0);
  const [denunciando, setDenunciando] = useState(false);
  const nav = useNavigate();
  const st = lista[i];
  const a = useDB((d) => d.anuncios.find((x) => x.id === st?.anuncioId));
  if (!st || !a) return null;
  const cor = CATEGORIAS[a.categoria].cor;
  return createPortal(
    <div className="viewer" role="dialog" aria-label="Story">
      <div className="vin">
        <div className="bars">{lista.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
        <div className="vh">
          <span className="pav" style={{ ['--c' as string]: cor }}>{st.autorNome.slice(0, 1)}</span>
          <div style={{ minWidth: 0 }}><b>{st.autorNome}</b><div className="hint" style={{ color: '#B9C4DA' }}>em {a.titulo}, {ha(st.criado)}</div></div>
          <button className="x" onClick={fechar} aria-label="Fechar">×</button>
        </div>
        <div className="media" style={{ ['--c' as string]: cor }}>
          {st.img ? <img src={st.img} alt="" /> : <span className="hint" style={{ position: 'absolute', top: 12, right: 12 }}>imagem de exemplo</span>}
          {st.legenda && <div className="cap">{st.legenda}</div>}
          <button className="tapl" onClick={() => i > 0 && setI(i - 1)} aria-label="Anterior" />
          <button className="tapr" onClick={() => (i < lista.length - 1 ? setI(i + 1) : fechar())} aria-label="Próximo" />
        </div>
        {denunciando ? (
          <div className="vf stack" style={{ gap: 6 }}>
            <span className="hint">Por que você está denunciando?</span>
            {MOTIVOS.map((m) => <button key={m} className="btn sm ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => { denunciarStory(st.id, 'Usuário', m); toast('Denúncia enviada. O story fica oculto até a curadoria analisar.'); fechar(); }}>{m}</button>)}
          </div>
        ) : (
          <div className="vf row">
            <span className="num hint">{falta(st.criado)}</span><span className="sp" />
            <button className="btn sm ghost" onClick={() => setDenunciando(true)}>Denunciar</button>
            <button className="btn sm" onClick={() => { fechar(); nav(`/anuncio/${a.id}`); }}>Ver local</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
