import type { Anuncio } from '../data/types';

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const rotuloHoras = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${String(h).replace('.', ',')}h`);

/** Ficar pode ter as duas pontas: algumas horas e diárias. */
export const temHoras = (a: Anuncio) => !!a.pacotes?.length && (a.tipoPreco === 'pacote' || a.tipoPreco === 'diaria');

const lotesAbertos = (a: Anuncio) => (a.lotes ?? []).filter((l) => l.vendidos < l.qtd);

export function precoBase(a: Anuncio): number {
  if (a.tipoPreco === 'ingresso') { const l = lotesAbertos(a); return l.length ? Math.min(...l.map((x) => x.preco)) : 0; }
  if (temHoras(a)) return a.pacotes![0].preco;
  return a.preco ?? 0;
}

export function rotuloPreco(a: Anuncio, curto = false): string {
  if (a.tipoPreco === 'ingresso') { const v = precoBase(a); return lotesAbertos(a).length ? (curto ? brl(v) : `Ingresso ${brl(v)}`) : 'Esgotado'; }
  if (a.tipoPreco === 'pacote' && a.pacotes?.length) {
    const p = a.pacotes[0];
    return brl(p.preco) + (a.porPessoa ? '/pessoa' : '') + (curto ? '' : ` · ${rotuloHoras(p.horas)}`);
  }
  if (a.tipoPreco === 'diaria' && a.pacotes?.length) {
    const p = a.pacotes[0];
    return curto ? brl(p.preco) : `${brl(p.preco)}/${rotuloHoras(p.horas)} ou ${brl(a.preco ?? 0)}/diária${a.porPessoa ? ', por pessoa' : ''}`;
  }
  if (a.tipoPreco === 'diaria') return `${brl(a.preco ?? 0)}/diária${a.porPessoa ? ' por pessoa' : ''}`;
  if (a.tipoPreco === 'servico') return brl(a.preco ?? 0) + (a.unidadePreco ?? '');
  if (a.unidadePreco) return brl(a.preco ?? 0) + a.unidadePreco;
  return curto ? `R$ ${Math.round((a.preco ?? 0) / 1000)} mil` : brl(a.preco ?? 0);
}

export const nota = (a: Anuncio) => (a.notaQualidade + a.notaCustoBeneficio) / 2;
export const virgula = (n: number, casas = 1) => n.toFixed(casas).replace('.', ',');

/** "sáb., 12/10, 22:00" */
export const dataEvento = (t: number) => new Date(t).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
