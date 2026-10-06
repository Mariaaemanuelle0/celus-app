// Regras de negócio do Celus (ver docs/DECISOES.md)
import type { Anuncio, Reserva } from '../data/types';
import type { Ponto } from './geo';

export const COMISSAO = 0.15;
export const COMISSAO_REDUZIDA = 0.13;
/** Ingressos (proposta): quem compra paga 10% de taxa de serviço; o organizador recebe o valor do ingresso inteiro. */
export const TAXA_INGRESSO = 0.1;
export const MAX_INGRESSOS_COMPRA = 6;
export const JORNADA_H = 12;
export const PAUSA_H = 6;
export const LIMITE_SEM_SUPERVISAO = 5;
const DIA = 86_400_000;
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
  if (r.tipo === 'ingresso') {
    const dentro7 = agora - r.criadoEm <= 7 * DIA, longe = r.inicio - agora >= 48 * 3600_000;
    if (r.ingressos?.some((i) => i.usadoEm)) return { valor: 0, regra: 'Algum ingresso desta compra já foi usado.' };
    return dentro7 && longe ? { valor: r.total, regra: 'Até 7 dias depois da compra e com mais de 48 h para o evento, devolvemos tudo.' }
      : { valor: 0, regra: 'Passou o prazo de cancelamento (7 dias da compra ou 48 h antes do evento). Se o organizador cancelar o evento, você recebe tudo de volta.' };
  }
  if (r.tipo === 'diaria') {
    const horas = (r.inicio - agora) / 3600_000;
    return horas >= 48 ? { valor: r.total, regra: 'Cancelamento grátis até 48 h antes do check-in.' } : { valor: r.total / 2, regra: 'Menos de 48 h antes do check-in: devolvemos 50%.' };
  }
  return agora < r.inicio || r.status === 'confirmada' || r.status === 'solicitado'
    ? { valor: r.total, regra: 'Antes de começar, o cancelamento é grátis.' }
    : { valor: 0, regra: 'Depois de começar, não há reembolso.' };
}

/** Taxa fixa de quem usa: R$ 0,50 por hora em espaço, R$ 2 por chamado; Ficar e Eventos sem taxa (preço final). */
export const taxaUsuarioDe = (a: Anuncio, tipo: Reserva['tipo']) =>
  tipo === 'servico' ? TAXA_SERVICO : a.categoria === 'ficar' || a.categoria === 'eventos' ? 0 : TAXA_HORA;

export const comissaoDe = (r: Reserva) => r.comissao ?? COMISSAO;
export const parteAnfitriao = (r: Reserva) => r.subtotal * (1 - comissaoDe(r));

/** Quando o dinheiro do anfitrião é liberado: hora e serviço D+1 depois do uso; estadia 24 h após o check-in. */
export function repasse(r: Reserva, agora = Date.now()): { estado: 'retido' | 'agendado' | 'liberado' | 'nenhum'; quando?: number } {
  if (r.status === 'cancelada' || r.status === 'recusado' || r.status === 'solicitado') return { estado: 'nenhum' };
  if (r.tipo === 'ingresso') {
    const quando = (r.fimEvento ?? r.inicio) + DIA;
    return { estado: agora >= quando ? 'liberado' : agora >= (r.fimEvento ?? r.inicio) ? 'agendado' : 'retido', quando };
  }
  if (r.tipo === 'diaria') {
    const quando = r.inicio + DIA;
    if (r.status !== 'concluida' && agora < r.inicio) return { estado: 'retido' };
    return { estado: agora >= quando ? 'liberado' : 'agendado', quando };
  }
  if (r.status !== 'concluida' || !r.fim) return { estado: 'retido' };
  const quando = r.fim + DIA;
  return { estado: agora >= quando ? 'liberado' : 'agendado', quando };
}

/** Jornada do profissional freelancer: até 12 h seguidas disponível, depois 6 h de pausa. */
export function jornada(a: Anuncio, agora = Date.now()): { disponivel: boolean; restanteMin: number; pausaMin: number } {
  if (a.donoId === 'celus-demo') return { disponivel: true, restanteMin: JORNADA_H * 60, pausaMin: 0 };
  if (a.disponivelDesde) {
    const fim = a.disponivelDesde + JORNADA_H * 3600_000;
    if (agora < fim) return { disponivel: true, restanteMin: (fim - agora) / 60_000, pausaMin: 0 };
    const pausaAte = fim + PAUSA_H * 3600_000;
    return { disponivel: false, restanteMin: 0, pausaMin: Math.max(0, (pausaAte - agora) / 60_000) };
  }
  return { disponivel: false, restanteMin: 0, pausaMin: a.pausaAte && agora < a.pausaAte ? (a.pausaAte - agora) / 60_000 : 0 };
}

/** Catraca livre: só conta quando ninguém do local acompanha a entrada. */
export const precisaSupervisao = (a: Anuncio) => a.tipoAcesso === 'fechadura' || a.tipoAcesso === 'responsavel' || a.tipoAcesso === 'portaria';
export const bloqueadoPorConferencia = (a: Anuncio) => precisaSupervisao(a) && (a.semSupervisao ?? 0) >= LIMITE_SEM_SUPERVISAO;

/** Moderação do chat aberto. */
const BLOQ = ['idiota', 'burro', 'porra', 'caralho', 'merda', 'puta', 'otario', 'otário', 'vagabund', 'viado', 'arrombad'];
export function moderar(txt: string): string | null {
  const t = txt.toLowerCase();
  if (BLOQ.some((w) => t.includes(w))) return 'Mensagem bloqueada: linguagem ofensiva.';
  if (/(\d[\s.-]?){8,}/.test(t)) return 'Por segurança, não compartilhe telefone no chat aberto.';
  if (/(https?:\/\/|www\.|\.com\b|\.br\b|@\w+\.\w+)/.test(t)) return 'Por segurança, links e e-mails não são permitidos no chat aberto.';
  if (/(por fora|chave pix|meu pix|pix direto|maquininha)/.test(t)) return 'Na Celus, pagamento só pelo app. Combinar pagamento por fora não é permitido.';
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

/** Pagamento só pelo app, antecipado, por cartão ou Pix. Nunca em dinheiro, maquininha ou Pix direto ao anfitrião. */
const POR_FORA = /(em dinheiro|dinheiro vivo|aceito dinheiro|maquininha|maquina de cart|m[aá]quina de cart|pague? (no|na hora|no local|na entrada)|pagamento (no|na) (local|hora|entrada)|por fora|chave pix|meu pix|pix direto)/i;
export const pedePagamentoPorFora = (txt: string) => POR_FORA.test(txt);
