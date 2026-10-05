import type { MarcaSemaforo } from '../data/types';
import { MIN_MARCACOES, SEMAFORO_DIAS, celulaSemaforo } from './regras';
import type { Ponto } from './geo';

export type Leitura = { cor: 'verde' | 'amarelo' | 'vermelho' | 'sem'; rotulo: string; n: number };

/** Marcações de exemplo (modo demonstração), estáveis por célula e horário. */
function exemplo(cell: string, slot: string): { n: number; soma: number } {
  let h = 2166136261;
  for (const ch of cell + slot) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = (x: number) => ((h >>> x) & 255) / 255;
  const peso = { manha: 1, tarde: 1, noite: 0.6, madrugada: 0.3 }[slot] ?? 1;
  const ajuste = { manha: 0.1, tarde: 0, noite: -0.35, madrugada: -0.65 }[slot] ?? 0;
  const n = Math.floor(r(3) * 12 * peso);
  const media = Math.max(1, Math.min(3, 2.2 + r(11) * 0.8 + ajuste));
  return { n, soma: media * n };
}

export function leitura(p: Ponto, slot: string, marcas: MarcaSemaforo[]): Leitura {
  const cell = celulaSemaforo(p);
  const base = exemplo(cell, slot);
  const limite = Date.now() - SEMAFORO_DIAS * 86_400_000;
  const reais = marcas.filter((m) => m.cell === cell && m.slot === slot && m.t > limite);
  const n = base.n + reais.length;
  const soma = base.soma + reais.reduce((s, m) => s + m.nivel, 0);
  if (n < MIN_MARCACOES) return { cor: 'sem', rotulo: 'Sem dados', n };
  const m = soma / n;
  if (m >= 2.5) return { cor: 'verde', rotulo: 'Verde', n };
  if (m >= 1.9) return { cor: 'amarelo', rotulo: 'Amarelo', n };
  return { cor: 'vermelho', rotulo: 'Vermelho', n };
}

export const COR_CSS = { verde: 'var(--ok)', amarelo: 'var(--warn)', vermelho: 'var(--bad)', sem: 'var(--line-2)' };
