import { useNavigate, useParams } from 'react-router-dom';
import { ACESSO, CATEGORIAS, COMODIDADES, PROFISSOES } from '../data/catalogo';
import { useAnuncios } from '../data/useAnuncios';
import { brl, rotuloHoras, virgula } from '../lib/format';

export function AnuncioPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { anuncios, carregando } = useAnuncios();
  const a = anuncios.find((x) => x.id === id);
  if (carregando) return <p className="meta">Carregando…</p>;
  if (!a) return <div className="empty">Anúncio não encontrado.</div>;

  const cat = CATEGORIAS[a.categoria];
  const sub = a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] : cat.subs[a.subcategoria];
  const servico = a.categoria === 'servicos';

  return (
    <>
      <button className="back" onClick={() => nav(-1)}>‹ Voltar</button>
      <div className="hero" style={{ ['--c' as string]: cat.cor }} />
      <div className="eyebrow" style={{ marginTop: 16 }}>{cat.nome} · {sub} · {a.bairro}</div>
      <h1>{a.titulo}</h1>
      <p style={{ margin: '0 0 14px' }}>{a.descricao}</p>

      <div className="stats">
        <div className="box stat"><b>{virgula(a.notaQualidade)}</b><span>Qualidade</span></div>
        <div className="box stat"><b>{virgula(a.notaCustoBeneficio)}</b><span>Custo-benefício</span></div>
        <div className="box stat"><b>{a.metragemM2 ?? '–'}</b><span>m²</span></div>
        <div className="box stat"><b>{a.totalSonhos}</b><span>sonham</span></div>
      </div>

      {a.tipoPreco === 'pacote' && a.pacotes && (
        <>
          <h2>Pacotes</h2>
          <div className="chips">{a.pacotes.map((p) => <span key={p.horas} className="coin">{rotuloHoras(p.horas)} · {brl(p.preco)}{a.porPessoa ? '/pessoa' : ''}</span>)}</div>
        </>
      )}
      {a.tipoPreco !== 'pacote' && <h2>Preço: <span className="num">{brl(a.preco ?? 0)}{a.tipoPreco === 'diaria' ? '/diária' : a.unidadePreco ?? ''}</span></h2>}

      {!servico && (
        <>
          <h2>O que tem aqui</h2>
          <div className="chips">{Object.entries(COMODIDADES).map(([k, n]) => <span key={k} className={`tag ${a.comodidades.includes(k) ? '' : 'off'}`}>{n}</span>)}</div>
          <p className="meta" style={{ marginTop: 10 }}>
            Até {a.capacidade} {a.capacidade > 1 ? 'pessoas' : 'pessoa'}
            {a.tipoAcesso ? ` · Acesso: ${ACESSO[a.tipoAcesso]}${a.responsavelLocal ? ` (${a.responsavelLocal})` : ''}` : ''}
            {a.limpezaInclusa ? ' · Limpeza inclusa' : ''}
          </p>
        </>
      )}

      {a.extras.length > 0 && (
        <>
          <h2>Extras do anfitrião</h2>
          <div className="chips">{a.extras.map((e) => <span key={e.nome} className="tag">{e.nome} · {brl(e.preco)}</span>)}</div>
        </>
      )}

      <h2>{servico ? 'Como trabalha' : 'Manual de bons modos'}</h2>
      <div className="manual">{a.manualBonsModos}</div>
      {servico && <p className="hint" style={{ marginTop: 8 }}>Profissional freelancer. Fica no máximo 12 h seguidas disponível e depois faz pausa de 6 h.</p>}

      <div style={{ marginTop: 20 }}>
        <button className="btn" disabled title="Chega na etapa 3">Reservar (em breve)</button>
      </div>
    </>
  );
}
