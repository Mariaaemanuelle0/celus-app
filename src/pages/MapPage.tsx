import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIAS, COMODIDADES, ORDEM_CATEGORIAS, PROFISSOES } from '../data/catalogo';
import type { Anuncio, Categoria } from '../data/types';
import { emDestaque, useAnuncios } from '../data/useAnuncios';
import { IconeCategoria, Miniatura, toast, useLocalizacao } from '../components/ui';
import { Mapa, type Celula, type Pino } from '../components/Mapa';
import { centroPiloto, distanciaKm, formatarDistancia, type Ponto } from '../lib/geo';
import { brl, nota, precoBase, rotuloPreco, virgula } from '../lib/format';
import { SLOTS, slotDe } from '../lib/regras';
import { COR_CSS, leitura } from '../lib/semaforo';
import { marcarSemaforo } from '../store/acoes';
import { useDB } from '../store/db';


const nomeSub = (a: Anuncio) =>
  a.categoria === 'servicos' && a.profissao ? PROFISSOES[a.subcategoria]?.[a.profissao] ?? '' : CATEGORIAS[a.categoria].subs[a.subcategoria] ?? '';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function pinPreco(a: Anuncio) {
  const v = precoBase(a);
  if (v >= 1000) return `R$ ${virgula(v / 1000, v % 1000 ? 1 : 0).replace(',0', '')} mil`;
  return brl(v);
}
/** Células do semáforo ao redor do ponto de busca, prontas para pintar no mapa. */
function celulasSemaforo(centro: Ponto, marcas: Parameters<typeof leitura>[2]): Celula[] {
  const slot = slotDe();
  const dLat = 0.8 / 110.574, dLng = 0.8 / (111.32 * Math.cos((centro.lat * Math.PI) / 180));
  const i0 = Math.floor(centro.lat / dLat), j0 = Math.floor(centro.lng / dLng);
  const out: Celula[] = [];
  for (let i = i0 - 3; i <= i0 + 3; i++) for (let j = j0 - 3; j <= j0 + 3; j++) {
    const l = leitura({ lat: (i + 0.5) * dLat, lng: (j + 0.5) * dLng }, slot, marcas);
    const cor = { verde: '#3DD68C', amarelo: '#F5B44A', vermelho: '#FF6B6B', sem: '#8E9AB4' }[l.cor];
    const [la, lo, la2, lo2] = [i * dLat, j * dLng, (i + 1) * dLat, (j + 1) * dLng];
    out.push({ cor, opacidade: l.cor === 'sem' ? 0.04 : 0.2, coords: [[lo, la], [lo2, la], [lo2, la2], [lo, la2], [lo, la]] });
  }
  return out;
}

function Semaforo({ centro, colorir, setColorir }: { centro: Ponto; colorir: boolean; setColorir: (v: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const marcas = useDB((d) => d.semaforo);
  const slot = slotDe();
  const l = leitura(centro, slot, marcas);
  const aceso = { vermelho: 1, amarelo: 2, verde: 3, sem: 0 }[l.cor];
  const OPC: [1 | 2 | 3, string, string, string][] = [[3, 'Verde', 'Tranquilo', 'var(--ok)'], [2, 'Amarelo', 'Atenção', 'var(--warn)'], [1, 'Vermelho', 'Não me sinto seguro', 'var(--bad)']];
  return (
    <>
      <button className="sema" aria-label={`Semáforo de segurança: ${l.rotulo}`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {[1, 2, 3].map((n) => <i key={n} className={aceso === n ? 'on' : ''} style={{ ['--c' as string]: ['', 'var(--bad)', 'var(--warn)', 'var(--ok)'][n] }} />)}
      </button>
      {aberto && (
        <div className="semapop">
          <div className="row" style={{ flexWrap: 'nowrap' }}><b className="sp" style={{ fontSize: 13 }}>Aqui, {SLOTS[slot].toLowerCase()}</b><button className="x" onClick={() => setAberto(false)} aria-label="Fechar">×</button></div>
          <div style={{ fontSize: 13, margin: '2px 0 10px' }}><b style={{ color: l.cor === 'sem' ? 'var(--muted)' : COR_CSS[l.cor] }}>{l.rotulo}</b> <span className="hint">{l.n} marcações</span></div>
          <div className="hint" style={{ marginBottom: 6 }}>Como está para você agora?</div>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            {OPC.map(([n, nome, desc, cor]) => (
              <button key={n} className="semaopt" style={{ ['--c' as string]: cor }} aria-label={`${nome}: ${desc}`} onClick={() => { const g = marcarSemaforo(centro, n); toast(g ? `Semáforo marcado. Você ganhou ${g} celus` : 'Semáforo marcado'); }}><i />{nome}</button>
            ))}
          </div>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={colorir} onChange={(e) => setColorir(e.target.checked)} /><span>Colorir o mapa</span></label>
          <p className="hint" style={{ marginTop: 6 }}>Percepção de quem passou por aqui, não garantia.</p>
        </div>
      )}
    </>
  );
}

export function MapPage() {
  const { anuncios } = useAnuncios();
  const gps = useLocalizacao();
  const [centro, setCentro] = useState<Ponto>(centroPiloto());
  const [seguindoGps, setSeguindoGps] = useState(true);
  const [raio, setRaio] = useState(1.5);
  const [cat, setCat] = useState<Categoria | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [prof, setProf] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState(false);
  const [comod, setComod] = useState<string[]>([]);
  const [precoMax, setPrecoMax] = useState(0);
  const [notaMin, setNotaMin] = useState(0);
  const [mudarPonto, setMudarPonto] = useState(false);
  const [colorir, setColorir] = useState(false);
  const [lista, setLista] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => { if (gps && seguindoGps) setCentro(gps); }, [gps, seguindoGps]);

  const termo = semAcento(busca.trim());
  const todos = useMemo(() => anuncios
    .filter((a) => !cat || a.categoria === cat)
    .filter((a) => !sub || a.subcategoria === sub)
    .filter((a) => !prof || a.profissao === prof)
    .filter((a) => comod.every((c) => a.comodidades.includes(c)))
    .filter((a) => !precoMax || a.categoria === 'imoveis' || precoBase(a) <= precoMax)
    .filter((a) => nota(a) >= notaMin)
    .filter((a) => !termo || semAcento(`${a.titulo} ${a.descricao} ${a.bairro} ${nomeSub(a)} ${CATEGORIAS[a.categoria].nome}`).includes(termo))
    .map((a) => ({ a, d: distanciaKm(centro, a) }))
    .sort((x, y) => x.d - y.d), [anuncios, cat, sub, prof, comod, precoMax, notaMin, termo, centro]);
  const noRaio = todos.filter((x) => x.d <= raio).sort((x, y) => Number(emDestaque(y.a)) - Number(emDestaque(x.a)));
  const nFiltros = comod.length + (precoMax ? 1 : 0) + (notaMin ? 1 : 0) + (raio !== 1.5 ? 1 : 0);
  const marcas = useDB((d) => d.semaforo);
  const celulas = useMemo(() => (colorir ? celulasSemaforo(centro, marcas) : []), [colorir, centro, marcas]);
  const pinos = useMemo<Pino[]>(() => todos.map(({ a, d }) => ({
    id: a.id, lat: a.lat, lng: a.lng, cor: CATEGORIAS[a.categoria].cor, html: `<i></i>${pinPreco(a)}`,
    classe: [d > raio ? 'far' : '', a.id === sel ? 'on' : '', emDestaque(a) ? 'dest' : ''].join(' '), z: a.id === sel ? 10 : emDestaque(a) ? 5 : 1,
  })), [todos, raio, sel]);
  const escolhido = noRaio.find((x) => x.a.id === sel) ?? todos.find((x) => x.a.id === sel);

  const escolher = (k: Categoria | null) => { setCat(cat === k ? null : k); setSub(null); setProf(null); setSel(null); };
  const limpar = () => { setComod([]); setPrecoMax(0); setNotaMin(0); setRaio(1.5); };

  return (
    <div className="mapa-tela">
      <div className="mapa-fundo">
        <Mapa centro={centro} raioKm={raio} celulas={celulas} mudarPonto={mudarPonto}
          pinos={pinos}
          onMover={(p) => { setCentro(p); setSeguindoGps(false); setMudarPonto(false); toast('Ponto de busca atualizado'); }}
          onPino={(id) => { setSel(id); setLista(false); }}
          onFundo={() => setSel(null)} />
      </div>

      <div className="mapa-topo">
        <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
          <div className="busca sp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input id="busca" type="search" placeholder="Do que você precisa agora?" value={busca} onChange={(e) => { setBusca(e.target.value); setLista(true); }} aria-label="Buscar" />
          </div>
          <button className={`fbtn ${nFiltros ? 'on' : ''}`} onClick={() => setFiltros(true)} aria-label={`Filtros${nFiltros ? `, ${nFiltros} ativos` : ''}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
            {nFiltros ? <b>{nFiltros}</b> : null}
          </button>
        </div>
        <div className="trilho" role="group" aria-label="Categoria">
          <button className="cat" aria-pressed={!cat} onClick={() => escolher(null)}>Tudo</button>
          {ORDEM_CATEGORIAS.map((k) => (
            <button key={k} className="cat" style={{ ['--c' as string]: CATEGORIAS[k].cor }} aria-pressed={cat === k} onClick={() => escolher(k)}>
              <IconeCategoria c={k} tamanho={15} />{CATEGORIAS[k].curto ?? CATEGORIAS[k].nome}
            </button>
          ))}
        </div>
        {cat && (
          <div className="trilho sub">
            {Object.entries(CATEGORIAS[cat].subs).map(([k, n]) => <button key={k} className="chip" aria-pressed={sub === k} onClick={() => { setSub(sub === k ? null : k); setProf(null); }}>{n}</button>)}
          </div>
        )}
        {cat === 'servicos' && sub && (
          <div className="trilho sub">
            {Object.entries(PROFISSOES[sub]).map(([k, n]) => <button key={k} className="chip" aria-pressed={prof === k} onClick={() => setProf(prof === k ? null : k)}>{n}</button>)}
          </div>
        )}
      </div>

      <div className="mapa-lado">
        <Semaforo centro={centro} colorir={colorir} setColorir={setColorir} />
        <button className={`mbtn ${mudarPonto ? 'on' : ''}`} onClick={() => setMudarPonto(!mudarPonto)} aria-label="Mudar ponto de busca" title="Mudar ponto de busca">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
        </button>
        {gps && !seguindoGps && <button className="mbtn" onClick={() => setSeguindoGps(true)} aria-label="Voltar para minha localização" title="Minha localização"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 2l7 19-7-4-7 4z" /></svg></button>}
      </div>
      {mudarPonto && <div className="picknote">Toque no mapa onde você vai estar</div>}

      <section className={`folha ${lista ? 'aberta' : ''}`} aria-label="Lugares encontrados">
        {escolhido && !lista ? (
          <div className="folha-sel">
            <Cartao a={escolhido.a} d={escolhido.d} />
            <button className="folha-mais" onClick={() => setLista(true)}>Ver os {noRaio.length} lugares no raio</button>
          </div>
        ) : (
          <>
            <button className="folha-alca" onClick={() => setLista(!lista)} aria-expanded={lista}>
              <i />
              <span className="row" style={{ flexWrap: 'nowrap', width: '100%' }}>
                <b className="sp">{noRaio.length} {noRaio.length === 1 ? 'lugar' : 'lugares'} até {formatarDistancia(raio)}</b>
                <span className="hint">{lista ? 'Ver mapa' : 'Ver lista'}</span>
              </span>
              {!lista && <span className="hint folha-sub">{gps ? (seguindoGps ? 'Perto de você' : 'Perto do ponto que você escolheu') : 'Sem sua localização: centro da cidade piloto'}</span>}
            </button>
            <div className="folha-lista">
              {noRaio.map(({ a, d }) => <Cartao key={a.id} a={a} d={d} />)}
              {!noRaio.length && <div className="empty">Nada nesse raio{termo ? ` para "${busca}"` : ''}. Aumente o raio nos filtros ou escolha outra categoria.</div>}
            </div>
          </>
        )}
      </section>

      {filtros && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Filtros" onClick={(e) => e.target === e.currentTarget && setFiltros(false)}>
          <div className="modal-in">
            <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
              <h2 className="sp" style={{ margin: 0 }}>Filtros</h2>
              <button className="x" onClick={() => setFiltros(false)} aria-label="Fechar">×</button>
            </div>
            <div className="flabel row" style={{ marginTop: 14 }}><span className="sp">Distância</span><span className="num">até {formatarDistancia(raio)}</span></div>
            <input type="range" min={0.3} max={5} step={0.1} value={raio} onChange={(e) => setRaio(Number(e.target.value))} aria-label="Raio de busca" />
            <div className="flabel" style={{ marginTop: 18 }}>O lugar precisa ter</div>
            <div className="chips">
              {Object.entries(COMODIDADES).map(([k, n]) => <button key={k} className="chip" aria-pressed={comod.includes(k)} onClick={() => setComod(comod.includes(k) ? comod.filter((x) => x !== k) : [...comod, k])}>{n}</button>)}
            </div>
            <div className="grid2" style={{ marginTop: 18 }}>
              <label className="campo">Preço até<select value={precoMax} onChange={(e) => setPrecoMax(Number(e.target.value))}>{[0, 5, 10, 20, 50, 100, 500, 2000].map((v) => <option key={v} value={v}>{v ? `R$ ${v}` : 'Qualquer'}</option>)}</select></label>
              <label className="campo">Nota mínima<select value={notaMin} onChange={(e) => setNotaMin(Number(e.target.value))}>{[0, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `${virgula(v)} ou mais` : 'Qualquer'}</option>)}</select></label>
            </div>
            <div className="row" style={{ marginTop: 22, flexWrap: 'nowrap' }}>
              <button className="btn ghost" onClick={limpar} disabled={!nFiltros}>Limpar</button>
              <button className="btn" onClick={() => { setFiltros(false); setLista(true); }}>Ver {noRaio.length} {noRaio.length === 1 ? 'lugar' : 'lugares'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Cartao({ a, d }: { a: Anuncio; d: number }) {
  return (
    <Link id={`a-${a.id}`} to={`/anuncio/${a.id}`} className="cartao">
      <Miniatura a={a} />
      <div className="cartao-txt">
        <span className="t">{a.titulo}</span>
        {emDestaque(a) && <span className="selo">Destaque</span>}
        <span className="meta">{nomeSub(a)} a {formatarDistancia(d)}{a.metragemM2 ? `, ${a.metragemM2} m²` : ''}</span>
        <span className="row" style={{ gap: 10 }}>
          <span className="preco">{rotuloPreco(a)}</span>
          <span className="nota"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>{virgula(nota(a))}</span>
        </span>
      </div>
    </Link>
  );
}
