import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Story } from '../data/types';
import { StoryRing } from '../components/Stories';
import { Miniatura, Voltar, lerImagem, toast, useLocalizacao } from '../components/ui';
import { rotuloPreco } from '../lib/format';
import { centroPiloto, distanciaKm, formatarDistancia } from '../lib/geo';
import { alternarSonho, curtir, podePostar, postarStory, storiesVisiveis } from '../store/acoes';
import { useDB } from '../store/db';

export function FeedPage() {
  const onde = useLocalizacao() ?? centroPiloto();
  const nav = useNavigate();
  const uid = useDB((d) => d.sessao)!;
  const anuncios = useDB((d) => d.anuncios);
  const stories = useDB((d) => d.stories);
  const denuncias = useDB((d) => d.denuncias);
  const curtidas = useDB((d) => d.curtidas);
  const sonhos = useDB((d) => d.sonhos);

  const porLocal = useMemo(() => {
    const m = new Map<string, Story[]>();
    storiesVisiveis(stories, denuncias).forEach((s) => m.set(s.anuncioId, [...(m.get(s.anuncioId) ?? []), s]));
    return [...m.entries()].map(([id, l]) => ({ a: anuncios.find((x) => x.id === id)!, l: l.sort((x, y) => x.criado - y.criado) }))
      .filter((x) => x.a).sort((x, y) => distanciaKm(onde, x.a) - distanciaKm(onde, y.a));
  }, [stories, denuncias, anuncios, onde]);

  const posts = useMemo(() => anuncios.filter((a) => a.status === 'aprovado' && a.categoria !== 'imoveis')
    .sort((x, y) => y.criadoEm - x.criadoEm || distanciaKm(onde, x) - distanciaKm(onde, y)).slice(0, 20), [anuncios, onde]);

  return (
    <>
      <h1>Perto de você agora</h1>
      <p className="lead">Stories de quem está nos lugares. Cada um some em 3 horas.</p>
      <div className="stories">
        {porLocal.length ? porLocal.map(({ a, l }) => <StoryRing key={a.id} lista={l} rotulo={a.titulo} cor={CATEGORIAS[a.categoria].cor} />)
          : <span className="hint">Nenhum story no ar por perto agora.</span>}
      </div>

      <div className="stack">
        {posts.map((a, i) => {
          const pid = `p-${a.id}`;
          const curti = curtidas.some((c) => c.userId === uid && c.postId === pid);
          const n = curtidas.filter((c) => c.postId === pid).length;
          const salvo = sonhos.some((s) => s.userId === uid && s.anuncioId === a.id);
          const sub = a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] : CATEGORIAS[a.categoria].subs[a.subcategoria];
          return (
            <div key={a.id}>
              {i === 2 && (
                <article className="dica" style={{ marginBottom: 12 }}>
                  <div className="eyebrow">Dica Celus</div>
                  <h3>Tem um espaço parado?</h3>
                  <p>Varanda, sala, vaga, banheiro com chuveiro. Cadastre, coloque seus extras e a equipe Celus revisa antes de publicar.</p>
                  <button className="btn sm" onClick={() => nav('/renda/anunciar')}>Quero rentabilizar</button>
                </article>
              )}
              <article className="box post">
                <div className="phead"><span className="pav" style={{ ['--c' as string]: CATEGORIAS[a.categoria].cor }}>{a.titulo.slice(0, 1)}</span>
                  <div className="sp" style={{ minWidth: 0 }}><b>{a.titulo}</b><div className="hint">{sub} a {formatarDistancia(distanciaKm(onde, a))}</div></div>
                  <span className="preco">{rotuloPreco(a, true)}</span></div>
                <Link to={`/anuncio/${a.id}`} className="postimg"><Miniatura a={a} grande /></Link>
                <p className="ptext">{a.descricao}</p>
                <div className="pact">
                  <button className="ab" aria-pressed={curti} onClick={() => curtir(pid)} aria-label="Curtir">
                    <svg viewBox="0 0 24 24" fill={curti ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg><span className="num">{n}</span></button>
                  <button className="ab" aria-pressed={salvo} onClick={() => alternarSonho(a.id)} aria-label="Guardar no livro dos sonhos">
                    <svg viewBox="0 0 24 24" fill={salvo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M6 4h12v17l-6-4-6 4z" /></svg><span className="num">{a.totalSonhos}</span></button>
                  <span className="sp" />
                  <Link className="btn sm ghost" to={`/anuncio/${a.id}`}>{a.categoria === 'servicos' ? 'Ver perfil' : 'Ver espaço'}</Link>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function PostarStory() {
  const { id } = useParams();
  const nav = useNavigate();
  const a = useDB((d) => d.anuncios.find((x) => x.id === id));
  const [img, setImg] = useState<string | undefined>();
  const [legenda, setLegenda] = useState('');
  const [noPerfil, setNoPerfil] = useState(true);
  if (!a) return <div className="empty">Local não encontrado.</div>;
  if (!podePostar(a.id)) return <><Voltar /><div className="empty">Para postar daqui, faça check-in no local ou tenha uma reserva ativa.</div></>;
  return (
    <>
      <Voltar />
      <div className="eyebrow">Novo story</div>
      <h1>{a.titulo}</h1>
      <label className="upload alto">{img ? <img src={img} alt="Sua foto" /> : <span>Toque para tirar ou escolher a foto</span>}
        <input id="s-foto" type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await lerImagem(f)); }} /></label>
      <div className="stack" style={{ marginTop: 14 }}>
        <label className="campo">Legenda<input id="s-legenda" maxLength={120} value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="O prato, o lugar, o momento" /></label>
        <label className="check"><input type="checkbox" checked={noPerfil} onChange={(e) => setNoPerfil(e.target.checked)} /><span>Mostrar também no meu perfil</span></label>
        <div className="dica"><p style={{ margin: 0 }}>O story fica ligado ao local, não à sua localização em tempo real, e some sozinho em 3 horas. Não mostre o rosto de quem não autorizou, nem crianças.</p></div>
        <button className="btn" disabled={!img} onClick={() => { const g = postarStory(a.id, legenda.trim(), img, noPerfil); toast(g ? `Story publicado. Você ganhou ${g} celus` : 'Story publicado'); nav(`/anuncio/${a.id}`); }}>Publicar story</button>
        <p className="hint">No app real, um filtro automático confere a imagem antes de publicar.</p>
      </div>
    </>
  );
}
