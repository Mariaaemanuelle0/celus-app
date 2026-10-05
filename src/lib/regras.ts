// Regras de negócio do Celus (ver docs/DECISOES.md)
import type { Anuncio, Reserva } from '../data/types';
import type { Ponto } from './geo';

export const COMISSAO = 0.15;
export const TAXA_HORA = 0.5;
export const TAXA_SERVICO = 2;
export const CARENCIA_MIN = 5;
export const AVISO_MIN = 20;
export const STORY_MS = 3 * 3600_000;
export const CHAT_MS = 10 * 60_000;
export const SEMAFORO_DIAS = 30;
export const MIN_MARCACOES = 3;
export const IDADE_MINIMA = 18;

export function idade(nascimento: string, hoje = new Date()): number {
  const [a, m, d] = nascimento.split('-').map(Number);
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos;
}

export const precoHora = (a: Anuncio) => (a.pacotes?.length ? a.pacotes[0].preco / a.pacotes[0].horas : 0);

/** Situação do uso de um espaço por hora: tempo contratado, excedente, multa com carência e teto. */
export function cobranca(r: Reserva, a: Anuncio, agora = Date.now()) {
  const ph = precoHora(a) * r.pessoas;
  const contratadoMin = (r.pacote?.horas ?? 0) * 60 + r.extensoes * 60;
  const inicio = r.usoInicio ?? r.inicio;
  const usadoMin = Math.max(0, (agora - inicio) / 60_000 + r.minutosTeste);
  const excedente = Math.max(0, usadoMin - contratadoMin);
  const cobravel = Math.max(0, excedente - CARENCIA_MIN);
  const teto = 2 * ph;
  const bruta = cobravel * (ph / 60);
  const multa = Math.min(bruta, teto);
  const subtotal = (r.pacote?.preco ?? 0) * r.pessoas + r.extensoes * ph + r.extras.reduce((s, e) => s + e.preco, 0) + multa;
  return { contratadoMin, usadoMin, restanteMin: contratadoMin - usadoMin, excedente, cobravel, multa, teto, bateuTeto: cobravel > 0 && bruta >= teto, subtotal, total: subtotal + r.taxaUsuario };
}

/** Reembolso ao cancelar (proposta a validar): hora e serviço grátis até o início; diária grátis até 48 h antes, depois 50%. */
export function reembolso(r: Reserva, agora = Date.now()): { valor: number; regra: string } {
  if (r.tipo === 'diaria') {
    const horas = (r.inicio - agora) / 3600_000;
    return horas >= 48 ? { valor: r.total, regra: 'Cancelamento grátis até 48 h antes do check-in.' } : { valor: r.total / 2, regra: 'Menos de 48 h antes do check-in: devolvemos 50%.' };
  }
  return agora < r.inicio || r.status === 'confirmada' || r.status === 'solicitado'
    ? { valor: r.total, regra: 'Antes de começar, o cancelamento é grátis.' }
    : { valor: 0, regra: 'Depois de começar, não há reembolso.' };
}

export const parteAnfitriao = (r: Reserva) => r.subtotal * (1 - COMISSAO);

/** Moderação do chat aberto. */
const BLOQ = ['idiota', 'burro', 'porra', 'caralho', 'merda', 'puta', 'otario', 'otário', 'vagabund', 'viado', 'arrombad'];
export function moderar(txt: string): string | null {
  const t = txt.toLowerCase();
  if (BLOQ.some((w) => t.includes(w))) return 'Mensagem bloqueada: linguagem ofensiva.';
  if (/(\d[\s.-]?){8,}/.test(t)) return 'Por segurança, não compartilhe telefone no chat aberto.';
  if (/(https?:\/\/|www\.|\.com\b|\.br\b|@\w+\.\w+)/.test(t)) return 'Por segurança, links e e-mails não são permitidos no chat aberto.';
  return null;
}

/** Grade geográfica: semáforo em células de ~800 m, chat em quadrantes de ~2 km. */
const KM_LAT = 1 / 110.574;
export function celula(p: Ponto, km: number): string {
  const dLat = km * KM_LAT;
  const dLng = km / (111.32 * Math.cos((p.lat * Math.PI) / 180));
  return `${Math.floor(p.lat / dLat)}_${Math.floor(p.lng / dLng)}`;
}
export const celulaSemaforo = (p: Ponto) => celula(p, 0.8);
export const quadranteChat = (p: Ponto) => celula(p, 2);

export const SLOTS: Record<string, string> = { madrugada: 'Madrugada', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
export function slotDe(t = new Date()): string {
  const h = t.getHours();
  return h < 6 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
}

/** Ganhos de celus (com limite diário onde há). */
export const GANHOS = [
  { chave: 'aval5', txt: 'Ser avaliado com 5 estrelas', v: 20 },
  { chave: 'aval4', txt: 'Ser avaliado com 4 estrelas', v: 10 },
  { chave: 'avaliar', txt: 'Avaliar depois de usar um espaço', v: 10 },
  { chave: 'reserva', txt: 'A cada R$ 10 em reservas', v: 1 },
  { chave: 'story', txt: 'Postar story no local', v: 5, limite: 3 },
  { chave: 'curtida', txt: 'Receber curtida no story', v: 1, limite: 20 },
  { chave: 'semaforo', txt: 'Marcar o semáforo de segurança', v: 2, limite: 5 },
];
