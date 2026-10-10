// Ranking de celus: quem mais ganhou celus no período (semana, mês, ano), separado em pessoas e comércios.
// Conta só celus ganhos usando o app. Não contam prêmios do ranking, loteria, devoluções nem celus recebidos em trocas e cauções.
import type { DB } from '../store/db';
import type { Lancamento } from '../data/types';
import { codigoQR, periodoDe, type Periodo } from './regras';

export type Tipo = 'pessoas' | 'comercios';
export type Participante = { id: string; nome: string; sub: string; foto?: string; pontos: number; ficticio?: boolean };

const NAO_CONTA = new Set(['premio', 'loteria']);
export function contaNoRanking(h: Lancamento): boolean {
  if (h.v <= 0) return false;
  if (h.k) return !NAO_CONTA.has(h.k);
  return !/^(Devolvido|Recebido|Pago|Prêmio)/.test(h.txt); // lançamentos antigos, sem k
}

/** Nome público: primeiro nome e inicial do sobrenome. */
export const nomeCurto = (nome: string) => { const p = nome.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };

/** O que a conta anuncia, se anuncia: vira o nome dela no ranking de comércios. */
export function comercioDe(d: Pick<DB, 'anuncios' | 'locaisSaude'>, uid: string): string | null {
  return d.locaisSaude.find((l) => l.donoId === uid && l.status === 'aprovado')?.nome
    ?? d.anuncios.find((a) => a.donoId === uid && a.status === 'aprovado')?.titulo ?? null;
}

/* Participantes fictícios do modo demonstração, para o ranking não começar vazio. Somem quando o Supabase for ligado. */
const PESSOAS = [['Júlia R.', 'Centro'], ['Pedro L.', 'Jardim'], ['Nina P.', 'Vila'], ['Carol M.', 'Canto'], ['Rafa T.', 'Jardim'], ['Duda S.', 'Centro'], ['Léo A.', 'Canto'], ['Bia F.', 'Vila'], ['Marta C.', 'Centro'], ['João V.', 'Vila'], ['Ana Q.', 'Jardim'], ['Paulo D.', 'Jardim']];
const COMERCIOS = [['Academia Fôlego', 'Academia'], ['Box Maré Alta', 'Box de treino'], ['Estúdio Respira Pilates', 'Estúdio'], ['Café da Varanda', 'Trabalho'], ['Padaria Pão Quente', 'Banheiro'], ['Camping do Seu Ivo', 'Ficar'], ['Casa de Festa Piscina', 'Eventos'], ['Estacionamento Central', 'Estacionamento']];
const TETO: Record<Periodo, number> = { semana: 260, mes: 640, ano: 5200 };

function ficticios(tipo: Tipo, p: Periodo, chave: string, frac: number): Participante[] {
  return (tipo === 'pessoas' ? PESSOAS : COMERCIOS).map(([nome, sub], i) => {
    const sorte = Number(codigoQR(chave, i + (tipo === 'pessoas' ? 0 : 100))) / 1_000_000;
    return { id: `demo-rk-${tipo}-${i}`, nome, sub, pontos: Math.round(TETO[p] * (0.2 + 0.8 * sorte) * frac), ficticio: true };
  });
}

/** Ranking de um período. Com `t` no meio do período, é o placar ao vivo; com um período fechado, é o resultado final. */
export function ranking(d: Pick<DB, 'usuarios' | 'carteiras' | 'anuncios' | 'locaisSaude'>, tipo: Tipo, p: Periodo, t = Date.now()): Participante[] {
  const { ini, fim, chave } = periodoDe(p, t);
  const agora = Date.now();
  const frac = agora >= fim ? 1 : Math.max(0.05, (agora - ini) / (fim - ini));
  const reais: Participante[] = [];
  for (const u of Object.values(d.usuarios)) {
    const comercio = comercioDe(d, u.id);
    if ((tipo === 'comercios') !== !!comercio) continue;
    const pontos = (d.carteiras[u.id]?.hist ?? []).filter((h) => h.t >= ini && h.t < fim && contaNoRanking(h)).reduce((s, h) => s + h.v, 0);
    reais.push({ id: u.id, nome: comercio ?? nomeCurto(u.nome), sub: comercio ? nomeCurto(u.nome) : 'Celus', foto: u.foto, pontos });
  }
  return [...reais, ...ficticios(tipo, p, chave, frac)].sort((a, b) => b.pontos - a.pontos || (a.ficticio ? 1 : 0) - (b.ficticio ? 1 : 0));
}
