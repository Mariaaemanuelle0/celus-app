import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Moeda, Voltar, lerImagem, toast, useLocalizacao } from '../components/ui';
import { centroPiloto, distanciaKm, formatarDistancia } from '../lib/geo';
import { anunciarTroca, confirmarRetirada, denunciarTroca, desistirTroca, quererTroca, removerTroca } from '../store/acoes';
import { carteiraDe, useDB, useUsuario } from '../store/db';
import type { Troca } from '../data/types';

import { NOME_TROCAS } from '../lib/perfil';
import { FEIRA_MIN } from '../lib/regras';

const quando = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 60 ? `há ${Math.max(1, m)} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };

function Valor({ t }: { t: Troca }) {
  return <span className="troca-preco"><Moeda tamanho={14} /> <span className="num">{t.preco}</span></span>;
}

function Foto({ t, grande }: { t: Troca; grande?: boolean }) {
  if (t.fotos[0]) return <img className={grande ? 'troca-hero' : 'troca-foto'} src={t.fotos[0]} alt="" />;
  return <span className={`${grande ? 'troca-hero' : 'troca-foto'} vazia`} aria-hidden="true">{t.titulo.slice(0, 1)}</span>;
}

/** Vitrine: o que as pessoas por perto não usam mais e pode servir para você. */
export function Trocas() {
  const u = useUsuario()!;
  const onde = useLocalizacao() ?? centroPiloto();
  const trocas = useDB((d) => d.trocas);
  const [filtro, setFiltro] = useState<'tudo' | 'minhas'>('tudo');
  const [q, setQ] = useState('');
  const termo = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = useMemo(() => trocas
    .filter((t) => filtro === 'minhas' ? (t.donoId === u.id || t.compradorId === u.id) && t.status !== 'removido' : t.status === 'disponivel' && t.donoId !== u.id)
    .filter((t) => !termo || `${t.titulo} ${t.descricao} ${t.bairro}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(termo))
    .map((t) => ({ t, d: distanciaKm(onde, t) }))
    .sort((a, b) => filtro === 'minhas' ? b.t.criadoEm - a.t.criadoEm : a.d - b.d), [trocas, filtro, termo, onde, u.id]);
  return (
    <>
      <Voltar para="/perfil" />
      <h1>{NOME_TROCAS}</h1>
      <p className="lead">O que você não usa mais vale celus para alguém aqui perto. E o que você procura pode estar na casa ao lado.</p>
      <div className="busca" style={{ boxShadow: 'none' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="tr-busca" type="search" placeholder="Muda, geladeira, cama, brinquedo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar item" />
      </div>
      <div className="seg" style={{ marginTop: 12 }}>
        <button aria-pressed={filtro === 'tudo'} onClick={() => setFiltro('tudo')}>Perto de mim</button>
        <button aria-pressed={filtro === 'minhas'} onClick={() => setFiltro('minhas')}>Minhas</button>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        {lista.map(({ t, d }) => (
          <Link key={t.id} to={`/troca/${t.id}`} className="box troca">
            <Foto t={t} />
            <span className="t">{t.titulo}</span>
            <span className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><Valor t={t} /><span className="hint">{filtro === 'minhas' ? ROTULO[t.status] : formatarDistancia(d)}</span></span>
          </Link>
        ))}
      </div>
      {!lista.length && <div className="empty">{filtro === 'minhas' ? 'Você ainda não anunciou nem pegou nada.' : 'Nada por aqui ainda. Comece anunciando algo que você não usa mais.'}</div>}
      <Link className="btn" style={{ marginTop: 16 }} to="/trocas/nova">Anunciar um item</Link>
      <p className="hint" style={{ marginTop: 10 }}>Os celus ficam guardados até a retirada. Só passam para quem entregou quando o código de quem recebeu é conferido.</p>
    </>
  );
}

const ROTULO: Record<Troca['status'], string> = { disponivel: 'Disponível', reservado: 'Reservado', entregue: 'Entregue', removido: 'Removido' };

export function NovaTroca() {
  const nav = useNavigate();
  const onde = useLocalizacao() ?? centroPiloto();
  const [f, setF] = useState({ titulo: '', descricao: '', bairro: '', estado: 'usado' as 'novo' | 'usado', preco: '', fotos: [] as string[] });
  const [erro, setErro] = useState('');
  return (
    <>
      <Voltar para="/trocas" />
      <h1>Anunciar item</h1>
      <p className="lead">Coisas que você enjoou ou não usa: muda de planta, móvel, eletrodoméstico, brinquedo.</p>
      <div className="stack">
        <label className="fotoadd">
          {f.fotos[0] ? <img src={f.fotos[0]} alt="Foto do item" /> : <span>Tirar ou escolher foto</span>}
          <input id="nt-foto" type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const x = e.target.files?.[0]; if (x) setF({ ...f, fotos: [await lerImagem(x)] }); }} />
        </label>
        <label className="campo">O que é<input id="nt-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Geladeira antiga funcionando" /></label>
        <label className="campo">Detalhes<textarea rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Estado, tamanho, se precisa retirar no local" /></label>
        <div className="grid2">
          <label className="campo">Estado<select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as 'novo' | 'usado' })}><option value="usado">Usado</option><option value="novo">Novo</option></select></label>
          <label className="campo">Bairro<input id="nt-bairro" value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} placeholder="Enseada" /></label>
        </div>
        <label className="campo">Valor em celus (a partir de {FEIRA_MIN})<input id="nt-preco" inputMode="numeric" placeholder={`Ex.: 30`} value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value.replace(/\D/g, '') })} /></label>
        <p className="hint">Referência: 1 celus = R$ 1. Anunciar rende 5 celus (até 3 itens por dia). O item fica no ponto onde você está agora; o endereço exato só se combina depois que alguém reservar.</p>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn" onClick={() => {
          const r = anunciarTroca({ ...f, preco: Number(f.preco || 0), lat: onde.lat, lng: onde.lng });
          if (r.ok) { toast(r.ganho ? `Item publicado. +${r.ganho} celus` : 'Item publicado'); nav('/trocas'); } else setErro(r.erro);
        }}>Publicar</button>
      </div>
    </>
  );
}

export function TrocaPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const u = useUsuario()!;
  const t = useDB((d) => d.trocas.find((x) => x.id === id));
  const dono = useDB((d) => (t ? d.usuarios[t.donoId] : undefined));
  const saldo = useDB((d) => carteiraDe(d, u.id).saldo);
  const onde = useLocalizacao() ?? centroPiloto();
  const [cod, setCod] = useState('');
  if (!t || t.status === 'removido') return <><Voltar para="/trocas" /><div className="empty">Este item não está mais disponível.</div></>;
  const meu = t.donoId === u.id, peguei = t.compradorId === u.id;
  const demo = t.donoId.startsWith('demo-');
  return (
    <>
      <Voltar para="/trocas" />
      <Foto t={t} grande />
      <div className="row" style={{ marginTop: 14 }}><span className="status aprovado">{t.estado === 'novo' ? 'Novo' : 'Usado'}</span><Valor t={t} /></div>
      <h1 style={{ marginTop: 10 }}>{t.titulo}</h1>
      <p className="meta">{t.bairro}, a {formatarDistancia(distanciaKm(onde, t))}. Publicado {quando(t.criadoEm)}{dono ? ` por ${dono.nome.split(' ')[0]}` : ''}.</p>
      {t.descricao && <p className="desc">{t.descricao}</p>}

      {t.status === 'disponivel' && !meu && (
        <>
          <button className="btn" style={{ marginTop: 14 }} disabled={saldo < t.preco} onClick={() => { const r = quererTroca(t.id); toast(r.ok ? 'Reservado para você' : r.erro); }}>
            Quero por {t.preco} celus
          </button>
          {saldo < t.preco && <p className="hint">Você tem {saldo} celus disponíveis.</p>}
          <button className="back" style={{ marginTop: 10 }} onClick={() => { denunciarTroca(t.id); toast('Obrigado. Vamos olhar este item'); }}>Denunciar item</button>
        </>
      )}

      {t.status === 'reservado' && peguei && (
        <div className="box" style={{ marginTop: 16 }}>
          <b>Reservado para você</b>
          <p className="hint" style={{ margin: '6px 0 10px' }}>Na retirada, mostre este código para quem entrega. Seus {t.preco} celus ficam guardados até lá.</p>
          <div className="code num" style={{ fontSize: 28, textAlign: 'center' }}>{t.codigo}</div>
          {demo && <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => { const r = confirmarRetirada(t.id, t.codigo!, true); toast(r.ok ? 'Retirada confirmada' : r.erro); }}>Simular retirada (teste)</button>}
          <button className="back" style={{ marginTop: 10 }} onClick={() => { desistirTroca(t.id); toast('Reserva desfeita'); }}>Desistir</button>
        </div>
      )}

      {t.status === 'reservado' && meu && (
        <div className="box" style={{ marginTop: 16 }}>
          <b>Alguém quer este item</b>
          <p className="hint" style={{ margin: '6px 0 10px' }}>Na entrega, peça o código de 4 dígitos e digite aqui. Só então os celus passam para você.</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="tr-cod" className="sp" inputMode="numeric" maxLength={4} value={cod} onChange={(e) => setCod(e.target.value.replace(/\D/g, ''))} placeholder="0000" aria-label="Código de retirada" />
            <button className="btn sm" onClick={() => { const r = confirmarRetirada(t.id, cod); toast(r.ok ? 'Entrega confirmada' : r.erro); }}>Confirmar</button>
          </div>
          <button className="back" style={{ marginTop: 10 }} onClick={() => { desistirTroca(t.id); toast('Reserva desfeita'); }}>Desfazer reserva</button>
        </div>
      )}

      {t.status === 'entregue' && <div className="alerta ok" style={{ marginTop: 16 }}>Entregue. {meu ? 'Obrigado por dar outra vida a este item.' : 'Bom proveito!'}</div>}
      {t.status === 'reservado' && !meu && !peguei && <div className="alerta" style={{ marginTop: 16 }}>Alguém já reservou este item.</div>}
      {meu && t.status === 'disponivel' && <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => { removerTroca(t.id); toast('Item removido'); nav('/trocas'); }}>Remover anúncio</button>}
    </>
  );
}
