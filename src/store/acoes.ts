import type { Anuncio, Extra, Ingresso, Pacote, Reserva } from '../data/types';
import { distanciaKm, type Ponto } from '../lib/geo';
import {
  CHAT_MS, COMISSAO, COMISSAO_REDUZIDA, MAX_INGRESSOS_COMPRA, TAXA_INGRESSO, IDADE_MINIMA, LIMITE_SEM_SUPERVISAO, STORY_MS, TAXA_SERVICO,
  bloqueadoPorConferencia, celulaSemaforo, taxaUsuarioDe, cobranca, idade, jornada, moderar, precisaSupervisao, reembolso, slotDe,
} from '../lib/regras';
import { carteiraDe, ganhar, ler, mudar, notificar, novoId, type DB } from './db';

const DIA = 86_400_000;
const quandoTxt = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Comissão que vale para uma reserva nova deste anúncio (13% se o anfitrião trocou celus pelo desconto). */
function comissaoAtual(d: DB, a: Anuncio): number {
  const dono = d.usuarios[a.donoId];
  return dono?.comissaoReduzidaAte && dono.comissaoReduzidaAte > Date.now() ? COMISSAO_REDUZIDA : COMISSAO;
}
export type Pagamento = 'pix' | 'cartao';

async function hash(txt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('celus:' + txt));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Resultado = { ok: true } | { ok: false; erro: string };
const falha = (erro: string): Resultado => ({ ok: false, erro });
const sessao = () => ler().sessao;

/* ---------- Conta ---------- */
export async function cadastrar(dados: { nome: string; email: string; senha: string; nascimento: string; aceite: boolean }): Promise<Resultado> {
  const email = dados.email.trim().toLowerCase();
  if (dados.nome.trim().length < 3) return falha('Digite seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return falha('Digite um e-mail válido.');
  if (dados.senha.length < 8) return falha('A senha precisa ter pelo menos 8 caracteres.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.nascimento)) return falha('Informe sua data de nascimento.');
  if (idade(dados.nascimento) < IDADE_MINIMA) return falha('menor');
  if (!dados.aceite) return falha('Para continuar, aceite os termos de uso e a política de privacidade.');
  if (Object.values(ler().usuarios).some((u) => u.email === email)) return falha('Já existe uma conta com este e-mail. Entre com sua senha.');
  const senhaHash = await hash(dados.senha);
  const id = novoId();
  mudar((d) => {
    d.usuarios[id] = { id, nome: dados.nome.trim(), email, senhaHash, nascimento: dados.nascimento, verificacao: 'nao_enviado', equipeCelus: false, albumPublico: false, criadoEm: Date.now() };
    d.sessao = id;
  });
  return { ok: true };
}

export async function entrar(email: string, senha: string): Promise<Resultado> {
  const u = Object.values(ler().usuarios).find((x) => x.email === email.trim().toLowerCase());
  if (!u || u.senhaHash !== (await hash(senha))) return falha('E-mail ou senha incorretos.');
  mudar((d) => { d.sessao = u.id; });
  return { ok: true };
}

export const sair = () => mudar((d) => { d.sessao = null; });

/** Modo demonstração: o documento é "analisado" na hora. No app real, vai para um serviço de verificação. */
export function enviarDocumento(selfie?: string) {
  const id = sessao(); if (!id) return;
  mudar((d) => { d.usuarios[id].verificacao = 'verificado'; if (selfie) d.usuarios[id].foto = selfie; });
}

/** Foto de perfil é sempre o rosto da pessoa: sem ela não dá para reservar, chamar profissional ou anunciar. */
const SEM_FOTO = 'Coloque uma foto do seu rosto no perfil. Quem recebe você precisa saber que é você.';
const semFoto = () => { const id = sessao(); return !id || !ler().usuarios[id]?.foto; };

export const alternarEquipe = () => { const id = sessao(); if (id) mudar((d) => { d.usuarios[id].equipeCelus = !d.usuarios[id].equipeCelus; }); };
export const alternarAlbum = () => { const id = sessao(); if (id) mudar((d) => { d.usuarios[id].albumPublico = !d.usuarios[id].albumPublico; }); };

/* ---------- Disponibilidade ---------- */
const diaStr = (t: number) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

export function checarDisponibilidade(a: Anuncio, inicio: number, fim: number, pessoas: number): string | null {
  const ini = new Date(inicio);
  if (a.agenda.bloqueios.includes(diaStr(inicio))) return 'O anfitrião bloqueou esta data.';
  if (a.tipoPreco === 'pacote') {
    const h = a.agenda.dias[ini.getDay()];
    if (!h) return 'Fechado neste dia da semana.';
    const minIni = ini.getHours() * 60 + ini.getMinutes();
    const minFim = minIni + (fim - inicio) / 60_000;
    if (minIni < h[0] || minFim > h[1]) return `Funciona das ${hhmm(h[0])} às ${hhmm(h[1])}. Escolha outro horário ou pacote menor.`;
  }
  const conflitos = ler().reservas.filter((r) => r.anuncioId === a.id && ['confirmada', 'em_uso'].includes(r.status) && r.inicio < fim && fimPrevisto(r, a) > inicio);
  if (a.porPessoa) {
    const ocupadas = conflitos.reduce((s, r) => s + r.pessoas, 0);
    if (ocupadas + pessoas > a.capacidade) return `Só ${Math.max(0, a.capacidade - ocupadas)} lugar(es) livre(s) nesse horário.`;
  } else if (conflitos.length) return 'Já está reservado nesse horário.';
  if (a.tipoPreco === 'diaria') {
    for (let t = inicio; t < fim; t += 86_400_000) if (a.agenda.bloqueios.includes(diaStr(t))) return 'Há uma data bloqueada no período.';
  }
  return null;
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function fimPrevisto(r: Reserva, a: Anuncio): number {
  if (r.tipo === 'diaria') return r.inicio + (r.noites ?? 1) * 86_400_000;
  if (r.tipo === 'servico') return r.inicio + (r.horasServico ?? 1) * 3600_000;
  return r.inicio + ((r.pacote?.horas ?? 0) + r.extensoes) * 3600_000 + (a.tipoPreco === 'pacote' ? 0 : 0);
}

/* ---------- Reservas ---------- */
const codigo = () => String(Math.floor(1000 + Math.random() * 9000));

const AGUARDANDO_CONFERENCIA = 'Este espaço está aguardando a conferência do anfitrião. Tente de novo mais tarde.';

export function reservarHora(a: Anuncio, pacote: Pacote, pessoas: number, extras: Extra[], inicio: number, pagamento: Pagamento = 'pix'): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  if (semFoto()) return { ok: false, erro: SEM_FOTO };
  if (bloqueadoPorConferencia(a)) return { ok: false, erro: AGUARDANDO_CONFERENCIA };
  if (a.categoria === 'ficar' && ler().usuarios[uid]?.verificacao !== 'verificado') return { ok: false, erro: 'Para reservar no Ficar, verifique sua identidade primeiro.' };
  const fim = inicio + pacote.horas * 3600_000;
  const erro = checarDisponibilidade(a, inicio, fim, pessoas);
  if (erro) return { ok: false, erro };
  const subtotal = pacote.preco * pessoas + extras.reduce((s, e) => s + e.preco, 0);
  const id = novoId();
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'hora', status: 'confirmada', inicio, pacote, pessoas, extras, extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: taxaUsuarioDe(a, 'hora'), multa: 0, total: subtotal + taxaUsuarioDe(a, 'hora'), codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now(), comissao: comissaoAtual(d, a), pagamento });
    d.usuarios[uid].ultimoPagamento = pagamento;
    notificar(d, uid, `Reserva confirmada: ${a.titulo}, ${quandoTxt(inicio)}.`, `/reserva/${id}`);
    notificar(d, a.donoId, `Nova reserva em ${a.titulo} para ${quandoTxt(inicio)}.`, '/renda');
  });
  return { ok: true, id };
}

export function reservarDiaria(a: Anuncio, checkin: number, noites: number, pessoas: number, extras: Extra[], pagamento: Pagamento = 'pix'): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  if (semFoto()) return { ok: false, erro: SEM_FOTO };
  if (bloqueadoPorConferencia(a)) return { ok: false, erro: AGUARDANDO_CONFERENCIA };
  if (a.categoria === 'ficar' && ler().usuarios[uid]?.verificacao !== 'verificado') return { ok: false, erro: 'Para reservar no Ficar, verifique sua identidade primeiro.' };
  const fim = checkin + noites * 86_400_000;
  if (pessoas > a.capacidade) return { ok: false, erro: `Capacidade máxima: ${a.capacidade} pessoas.` };
  const erro = checarDisponibilidade(a, checkin, fim, pessoas);
  if (erro) return { ok: false, erro };
  const subtotal = (a.preco ?? 0) * noites * (a.porPessoa ? pessoas : 1) + extras.reduce((s, e) => s + e.preco, 0);
  const id = novoId();
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'diaria', status: 'confirmada', inicio: checkin, noites, pessoas, extras, extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: 0, multa: 0, total: subtotal, codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now(), comissao: comissaoAtual(d, a), pagamento });
    d.usuarios[uid].ultimoPagamento = pagamento;
    notificar(d, uid, `Estadia confirmada: ${a.titulo}, check-in ${quandoTxt(checkin)}.`, `/reserva/${id}`);
    notificar(d, a.donoId, `Nova estadia em ${a.titulo}: ${noites} diária${noites > 1 ? 's' : ''} a partir de ${quandoTxt(checkin)}.`, '/renda');
  });
  return { ok: true, id };
}

export function chamarProfissional(a: Anuncio, horas: number, pagamento: Pagamento = 'pix', destino?: Ponto | null): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  if (semFoto()) return { ok: false, erro: SEM_FOTO };
  if (!jornada(a).disponivel) return { ok: false, erro: 'Este profissional não está disponível agora.' };
  if (ler().reservas.some((r) => r.anuncioId === a.id && ['solicitado', 'aceito', 'a_caminho'].includes(r.status))) return { ok: false, erro: 'Este profissional já está atendendo um chamado. Tente outro ou aguarde.' };
  const id = novoId();
  const subtotal = (a.preco ?? 0) * horas;
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'servico', status: 'solicitado', inicio: Date.now(), horasServico: horas, pessoas: 1, extras: [], extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: TAXA_SERVICO, multa: 0, total: subtotal + TAXA_SERVICO, codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now(), comissao: comissaoAtual(d, a), pagamento, destino: destino ?? undefined });
    d.usuarios[uid].ultimoPagamento = pagamento;
    notificar(d, a.donoId, `Novo chamado de ${d.usuarios[uid]?.nome.split(' ')[0] ?? 'cliente'}: ${brlTxt(subtotal)}. Aceite ou recuse.`, '/renda');
  });
  return { ok: true, id };
}

const AVISO_CHAMADO: Partial<Record<Reserva['status'], string>> = {
  aceito: 'aceitou seu chamado', a_caminho: 'está a caminho. Quando chegar, diga o seu código', em_andamento: 'começou o serviço', recusado: 'não pode atender agora. Você não paga nada', concluida: 'marcou o serviço como concluído',
};

export const avancarChamado = (id: string, status: Reserva['status']) =>
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === id); if (!r) return;
    const a = d.anuncios.find((x) => x.id === r.anuncioId);
    r.status = status;
    if (status === 'recusado') r.reembolso = r.total;
    if (status === 'concluida') { r.fim = Date.now(); ganhar(d, r.userId, 'reserva', `Serviço de ${brlTxt(r.total)}`, Math.floor(r.total / 10)); notificar(d, a?.donoId, `Serviço concluído. Avalie ${d.usuarios[r.userId]?.nome.split(' ')[0] ?? 'o cliente'}.`, '/renda'); }
    const aviso = AVISO_CHAMADO[status];
    if (aviso && a) notificar(d, r.userId, `${a.titulo.split(',')[0]} ${aviso}.`, `/reserva/${r.id}`);
  });

/** Profissional liga ou desliga o "disponível agora". */
export function alternarDisponivel(anuncioId: string): Resultado {
  const a = ler().anuncios.find((x) => x.id === anuncioId); if (!a) return falha('Anúncio não encontrado.');
  const j = jornada(a);
  if (!j.disponivel && j.pausaMin > 0) return falha(`Pausa obrigatória: você volta em ${Math.ceil(j.pausaMin / 60)} h.`);
  mudar((d) => {
    const x = d.anuncios.find((y) => y.id === anuncioId)!;
    if (j.disponivel) { x.disponivelDesde = null; }
    else { x.disponivelDesde = Date.now(); x.pausaAte = undefined; }
  });
  return { ok: true };
}

/** Com fechadura digital, o código abre a porta e a própria pessoa inicia o uso. */
export const iniciarUso = (id: string) => mudar((d) => {
  const r = d.reservas.find((x) => x.id === id); if (!r || r.status !== 'confirmada') return;
  const a = d.anuncios.find((x) => x.id === r.anuncioId);
  if (a?.tipoAcesso !== 'fechadura' && !r.chegadaConfirmada) return;
  r.status = 'em_uso'; r.usoInicio = Date.now();
});

const MAX_TENTATIVAS = 5;

/** Quem recebe (anfitrião ou profissional) digita o código que a pessoa mostra. Só assim o uso ou o serviço começa. */
export function confirmarChegada(reservaId: string, digitado: string, demo = false): Resultado {
  const d0 = ler(); const uid = d0.sessao;
  const r = d0.reservas.find((x) => x.id === reservaId); if (!r) return falha('Reserva não encontrada.');
  const a = d0.anuncios.find((x) => x.id === r.anuncioId); if (!a) return falha('Anúncio não encontrado.');
  if (!demo && a.donoId !== uid) return falha('Só quem recebe pode conferir o código.');
  if (demo && a.donoId !== 'celus-demo') return falha('Só para anúncios de demonstração.');
  if (r.codigoTravado) return falha('Conferência travada depois de muitas tentativas. A equipe Celus foi avisada.');
  if (digitado.trim() !== r.codigo) {
    mudar((d) => {
      const x = d.reservas.find((y) => y.id === reservaId)!;
      x.tentativasCodigo = (x.tentativasCodigo ?? 0) + 1;
      if (x.tentativasCodigo >= MAX_TENTATIVAS) { x.codigoTravado = true; notificar(d, x.userId, 'A conferência do seu código travou depois de muitas tentativas erradas. A equipe Celus vai verificar.', `/reserva/${x.id}`); }
    });
    const resta = MAX_TENTATIVAS - ((r.tentativasCodigo ?? 0) + 1);
    return falha(resta > 0 ? `Código errado. Restam ${resta} tentativa${resta > 1 ? 's' : ''}.` : 'Código errado. Conferência travada e equipe Celus avisada.');
  }
  mudar((d) => {
    const x = d.reservas.find((y) => y.id === reservaId)!;
    x.chegadaConfirmada = Date.now();
    if (x.tipo === 'hora' && x.status === 'confirmada') { x.status = 'em_uso'; x.usoInicio = Date.now(); }
    if (x.tipo === 'servico' && x.status === 'a_caminho') x.status = 'em_andamento';
    notificar(d, x.userId, x.tipo === 'servico' ? 'Código conferido. O serviço começou.' : x.tipo === 'hora' ? 'Código conferido. Seu tempo começou a contar.' : 'Check-in confirmado. Boa estadia.', x.tipo === 'hora' ? `/uso/${x.id}` : `/reserva/${x.id}`);
  });
  return { ok: true };
}

/** Cliente avisa que pediram pagamento por fora. Vai para a curadoria. */
export const relatarPorFora = (reservaId: string) => mudar((d) => { const r = d.reservas.find((x) => x.id === reservaId); if (r && !r.pagamentoPorFora) r.pagamentoPorFora = Date.now(); });
export const arquivarPorFora = (reservaId: string, pausar: boolean) => mudar((d) => {
  const r = d.reservas.find((x) => x.id === reservaId); if (!r) return;
  r.pagamentoPorFora = undefined;
  const a = d.anuncios.find((x) => x.id === r.anuncioId);
  if (pausar && a) { a.status = 'pausado'; notificar(d, a.donoId, `${a.titulo} foi pausado: houve pedido de pagamento fora do app. Na Celus, todo pagamento é feito pelo app.`, '/renda'); }
});

/** Curadoria libera uma conferência travada. */
export const destravarCodigo = (reservaId: string) => mudar((d) => { const r = d.reservas.find((x) => x.id === reservaId); if (r) { r.codigoTravado = false; r.tentativasCodigo = 0; } });
export const estender = (id: string) => mudar((d) => { const r = d.reservas.find((x) => x.id === id); if (r) r.extensoes++; });
export const avancarTeste = (id: string, min: number) => mudar((d) => { const r = d.reservas.find((x) => x.id === id); if (r) r.minutosTeste += min; });

const brlTxt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function encerrar(id: string) {
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === id); if (!r) return;
    const a = d.anuncios.find((x) => x.id === r.anuncioId); if (!a) return;
    if (r.tipo === 'hora') {
      const c = cobranca(r, a);
      r.multa = c.multa; r.subtotal = c.subtotal; r.total = c.total;
    }
    r.status = 'concluida'; r.fim = Date.now();
    ganhar(d, r.userId, 'reserva', `Reserva de ${brlTxt(r.total)} em ${a.titulo}`, Math.floor(r.total / 10));
    notificar(d, a.donoId, `${d.usuarios[r.userId]?.nome.split(' ')[0] ?? 'O hóspede'} saiu de ${a.titulo}. Avalie com estrelas.`, '/renda');
    if (precisaSupervisao(a)) {
      a.semSupervisao = (a.semSupervisao ?? 0) + 1;
      if (a.semSupervisao >= LIMITE_SEM_SUPERVISAO) notificar(d, a.donoId, `${a.titulo} teve ${LIMITE_SEM_SUPERVISAO} locações seguidas sem ninguém conferir. Confira o espaço para liberar novas reservas.`, '/renda');
    }
  });
}

/** Anfitrião (ou verificador) conferiu o espaço: zera a contagem da catraca livre. */
export const conferirEspaco = (anuncioId: string) => mudar((d) => { const a = d.anuncios.find((x) => x.id === anuncioId); if (a) a.semSupervisao = 0; });

/** Aviso de 20 minutos, registrado uma vez por reserva. */
export function avisarFim(reservaId: string, minutos: number) {
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === reservaId); if (!r || r.avisoFimEnviado) return;
    r.avisoFimEnviado = true;
    notificar(d, r.userId, `Faltam ${minutos} minutos na sua reserva. Estenda com um toque se precisar.`, `/uso/${r.id}`);
  });
}

export function cancelar(id: string): number {
  let valor = 0;
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === id); if (!r) return;
    valor = reembolso(r).valor;
    r.status = 'cancelada'; r.reembolso = valor;
    const a = d.anuncios.find((x) => x.id === r.anuncioId);
    notificar(d, a?.donoId, `Reserva cancelada em ${a?.titulo ?? 'seu anúncio'} (${quandoTxt(r.inicio)}).`, '/renda');
  });
  return valor;
}

/* ---------- Avaliações (só estrelas) ---------- */
export function avaliarAnuncio(reservaId: string, qualidade: number, custoBeneficio: number, devolveu?: boolean) {
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === reservaId); if (!r || r.avaliadaPeloUsuario) return;
    const a = d.anuncios.find((x) => x.id === r.anuncioId); if (!a) return;
    a.notaQualidade = (a.notaQualidade * a.totalAvaliacoes + qualidade) / (a.totalAvaliacoes + 1);
    a.notaCustoBeneficio = (a.notaCustoBeneficio * a.totalAvaliacoes + custoBeneficio) / (a.totalAvaliacoes + 1);
    a.totalAvaliacoes++;
    r.avaliadaPeloUsuario = true;
    d.avaliacoes.push({ id: novoId(), reservaId, autorId: r.userId, alvo: 'anuncio', alvoId: a.id, qualidade, custoBeneficio, devolveu, criadoEm: Date.now() });
    ganhar(d, r.userId, 'avaliar', `Você avaliou ${a.titulo}`);
    notificar(d, a.donoId, `${a.titulo} recebeu uma avaliação nova.`, '/renda');
  });
}

export function avaliarHospede(reservaId: string, nota: number) {
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === reservaId); if (!r || r.avaliadaPeloAnfitriao) return;
    const a = d.anuncios.find((x) => x.id === r.anuncioId);
    r.avaliadaPeloAnfitriao = true;
    d.avaliacoes.push({ id: novoId(), reservaId, autorId: a?.donoId ?? '', alvo: 'usuario', alvoId: r.userId, nota, criadoEm: Date.now() });
    if (nota === 5) ganhar(d, r.userId, 'aval5', `Avaliação 5 estrelas de ${a?.titulo ?? 'anfitrião'}`);
    if (nota === 4) ganhar(d, r.userId, 'aval4', `Avaliação 4 estrelas de ${a?.titulo ?? 'anfitrião'}`);
    notificar(d, r.userId, `Você recebeu ${nota} estrela${nota > 1 ? 's' : ''} de ${a?.titulo ?? 'um anfitrião'}.`, '/perfil');
  });
}

/* ---------- Sonhos, check-in, stories ---------- */
export function alternarSonho(anuncioId: string) {
  const uid = sessao(); if (!uid) return;
  mudar((d) => {
    const i = d.sonhos.findIndex((s) => s.userId === uid && s.anuncioId === anuncioId);
    const a = d.anuncios.find((x) => x.id === anuncioId);
    if (i >= 0) { d.sonhos.splice(i, 1); if (a) a.totalSonhos = Math.max(0, a.totalSonhos - 1); }
    else { d.sonhos.push({ userId: uid, anuncioId }); if (a) a.totalSonhos++; }
  });
}

/** Check-in só vale perto do local (até 300 m). */
export function checkin(a: Anuncio, onde: Ponto | null): Resultado {
  const uid = sessao(); if (!uid) return falha('Entre na sua conta.');
  if (!onde) return falha('Precisamos da sua localização para confirmar que você está no local.');
  if (distanciaKm(onde, a) > 0.3) return falha('Você precisa estar no local para fazer check-in.');
  mudar((d) => { d.checkins.push({ userId: uid, anuncioId: a.id, t: Date.now() }); });
  return { ok: true };
}

export function podePostar(anuncioId: string): boolean {
  const d = ler(); const uid = d.sessao; if (!uid) return false;
  const recente = (t: number) => Date.now() - t < 12 * 3600_000;
  return d.checkins.some((c) => c.userId === uid && c.anuncioId === anuncioId && recente(c.t))
    || d.reservas.some((r) => r.userId === uid && r.anuncioId === anuncioId && ['confirmada', 'em_uso'].includes(r.status));
}

export function postarStory(anuncioId: string, legenda: string, img: string | undefined, noPerfil: boolean): number {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return 0;
  let ganho = 0;
  mudar((d) => {
    const u = d.usuarios[uid];
    const a = d.anuncios.find((x) => x.id === anuncioId);
    d.stories.push({ id: novoId(), anuncioId, autorId: uid, autorNome: u.nome.split(' ')[0] + ' ' + (u.nome.split(' ')[1]?.[0] ?? '') + '.', criado: Date.now(), legenda, img, noPerfil });
    ganho = ganhar(d, uid, 'story', `Story em ${a?.titulo ?? 'local'}`);
  });
  return ganho;
}

export const storiesAtivos = <T extends { criado: number }>(stories: T[]): T[] => stories.filter((s) => Date.now() - s.criado < STORY_MS);

export function curtir(postId: string) {
  const uid = sessao(); if (!uid) return;
  mudar((d) => {
    const i = d.curtidas.findIndex((c) => c.userId === uid && c.postId === postId);
    if (i >= 0) d.curtidas.splice(i, 1); else d.curtidas.push({ userId: uid, postId });
  });
}

export function denunciarStory(storyId: string, por: 'Usuário' | 'Anfitrião', motivo: string) {
  mudar((d) => {
    if (!d.denuncias.some((x) => x.storyId === storyId)) d.denuncias.push({ id: novoId(), storyId, por, motivo, t: Date.now() });
  });
}

export function decidirDenuncia(id: string, remover: boolean) {
  mudar((d) => {
    const den = d.denuncias.find((x) => x.id === id); if (!den) return;
    if (remover) d.stories = d.stories.filter((s) => s.id !== den.storyId);
    d.denuncias = d.denuncias.filter((x) => x.storyId !== den.storyId);
  });
}

/* ---------- Chat do quadrante ---------- */
let ultimaMsg = 0;
export function enviarMensagem(quad: string, txt: string): Resultado {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return falha('Entre na sua conta.');
  const u = d0.usuarios[uid];
  if (u.verificacao !== 'verificado') return falha('Verifique seu documento para usar o chat.');
  const limpo = txt.trim(); if (!limpo) return falha('');
  const bloq = moderar(limpo); if (bloq) return falha(bloq);
  if (Date.now() - ultimaMsg < 10_000) return falha('Aguarde alguns segundos para mandar outra mensagem.');
  ultimaMsg = Date.now();
  mudar((d) => {
    d.chat = d.chat.filter((m) => Date.now() - m.t < CHAT_MS);
    d.chat.push({ id: novoId(), quad, autorId: uid, autorNome: u.nome.split(' ')[0], t: Date.now(), txt: limpo });
  });
  return { ok: true };
}

export const ocultarMensagem = (id: string) => mudar((d) => { d.chat = d.chat.filter((m) => m.id !== id); });

/* ---------- Semáforo ---------- */
export function marcarSemaforo(p: Ponto, nivel: 1 | 2 | 3): number {
  const uid = sessao(); if (!uid) return 0;
  let ganho = 0;
  mudar((d) => {
    d.semaforo.push({ cell: celulaSemaforo(p), slot: slotDe(), nivel, t: Date.now(), userId: uid });
    ganho = ganhar(d, uid, 'semaforo', 'Semáforo marcado');
  });
  return ganho;
}

/* ---------- Celus ---------- */
export function resgatar(beneficioId: string): string | null {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return null;
  const b = d0.beneficios.find((x) => x.id === beneficioId); if (!b) return null;
  if (carteiraDe(d0, uid).saldo < b.custo) return null;
  const cod = 'CL-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  mudar((d) => {
    const c = carteiraDe(d, uid);
    c.saldo -= b.custo;
    c.hist.unshift({ t: Date.now(), txt: 'Resgate: ' + b.nome, v: -b.custo });
    const a = b.anuncioId ? d.anuncios.find((x) => x.id === b.anuncioId) : null;
    c.vales.unshift({ nome: b.nome, onde: a ? a.titulo : b.grupo === 'evento' ? 'Evento Celus' : 'No app', codigo: cod, t: Date.now() });
    d.carteiras[uid] = c;
    if (a) notificar(d, a.donoId, `Alguém trocou celus por "${b.nome}" em ${a.titulo}. Código ${cod}: confira na entrega.`, '/renda');
  });
  return cod;
}

/** Benefícios de quem anuncia: têm efeito real no app. */
export function resgatarAnfitriao(tipo: 'destaque' | 'comissao' | 'campanha', anuncioId?: string): Resultado {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return falha('Entre na sua conta.');
  const id = { destaque: 'b-dest', comissao: 'b-com', campanha: 'b-campa' }[tipo];
  const b = d0.beneficios.find((x) => x.id === id); if (!b) return falha('Benefício indisponível.');
  if (carteiraDe(d0, uid).saldo < b.custo) return falha('Saldo de celus insuficiente.');
  const meus = d0.anuncios.filter((a) => a.donoId === uid && a.status === 'aprovado');
  if (!meus.length) return falha('Você precisa de um anúncio publicado no mapa.');
  const alvo = anuncioId ? meus.find((a) => a.id === anuncioId) : meus[0];
  if (tipo !== 'comissao' && !alvo) return falha('Escolha um anúncio seu.');
  const u = d0.usuarios[uid];
  if (tipo === 'comissao' && u.comissaoReduzidaAte && Date.now() < u.comissaoReduzidaAte) return falha('Sua comissão já está reduzida. Dá para usar de novo quando o prazo acabar.');
  mudar((d) => {
    const c = carteiraDe(d, uid);
    c.saldo -= b.custo;
    c.hist.unshift({ t: Date.now(), txt: 'Resgate: ' + b.nome, v: -b.custo });
    d.carteiras[uid] = c;
    const a = alvo && d.anuncios.find((x) => x.id === alvo.id);
    if (tipo === 'destaque' && a) a.destaqueAte = Math.max(Date.now(), a.destaqueAte ?? 0) + DIA;
    if (tipo === 'campanha' && a) { const f = new Date(); a.campanhaAte = new Date(f.getFullYear(), f.getMonth() + 1, 1).getTime(); }
    if (tipo === 'comissao') d.usuarios[uid].comissaoReduzidaAte = Date.now() + 30 * DIA;
  });
  return { ok: true };
}

export function criarBeneficio(anuncioId: string, nome: string, custo: number) {
  mudar((d) => {
    const a = d.anuncios.find((x) => x.id === anuncioId);
    d.beneficios.push({ id: novoId(), grupo: 'local', anuncioId, nome, desc: `Em ${a?.titulo ?? 'seu espaço'}.`, custo });
  });
}

/* ---------- Anúncios (Rentabilizar) ---------- */
export function criarAnuncio(a: Omit<Anuncio, 'id' | 'donoId' | 'status' | 'notaQualidade' | 'notaCustoBeneficio' | 'totalAvaliacoes' | 'totalSonhos' | 'criadoEm'>): string | null {
  const uid = sessao(); if (!uid || semFoto()) return null;
  const id = novoId();
  mudar((d) => { d.anuncios.push({ ...a, id, donoId: uid, status: 'pendente', notaQualidade: 5, notaCustoBeneficio: 5, totalAvaliacoes: 0, totalSonhos: 0, criadoEm: Date.now() }); });
  return id;
}

export const decidirAnuncio = (id: string, status: 'aprovado' | 'recusado') => mudar((d) => {
  const a = d.anuncios.find((x) => x.id === id); if (!a) return;
  a.status = status;
  notificar(d, a.donoId, status === 'aprovado' ? `${a.titulo} foi aprovado e já está no mapa.` : `${a.titulo} não foi aprovado. Revise as fotos e o texto e envie de novo.`, '/renda');
});

export const conferirRevisao = (id: string, manter: boolean) => mudar((d) => {
  const a = d.anuncios.find((x) => x.id === id); if (!a) return;
  a.revisar = false;
  if (!manter) { a.status = 'pausado'; notificar(d, a.donoId, `As mudanças em ${a.titulo} não foram aprovadas. O anúncio foi pausado até você corrigir.`, '/renda'); }
});

type DadosAnuncio = Omit<Anuncio, 'id' | 'donoId' | 'status' | 'notaQualidade' | 'notaCustoBeneficio' | 'totalAvaliacoes' | 'totalSonhos' | 'criadoEm' | 'agenda' | 'lat' | 'lng'>;

/** Edita um anúncio. Preço e extras valem só para as próximas reservas; título, fotos e descrição passam pela curadoria. */
export function editarAnuncio(id: string, dados: DadosAnuncio) {
  mudar((d) => {
    const a = d.anuncios.find((x) => x.id === id); if (!a || a.donoId !== d.sessao) return;
    const mudouVitrine = a.titulo !== dados.titulo || a.descricao !== dados.descricao || JSON.stringify(a.fotos) !== JSON.stringify(dados.fotos);
    Object.assign(a, dados);
    if (mudouVitrine && a.status === 'aprovado') a.revisar = true;
    if (a.status === 'recusado') a.status = 'pendente';
  });
}
export const pausarAnuncio = (id: string) => mudar((d) => { const a = d.anuncios.find((x) => x.id === id); if (a) a.status = a.status === 'pausado' ? 'aprovado' : 'pausado'; });
export const salvarAgenda = (id: string, agenda: Anuncio['agenda']) => mudar((d) => { const a = d.anuncios.find((x) => x.id === id); if (a) a.agenda = agenda; });

export { cobranca };

/** Stories no ar: dentro das 3 h e sem denúncia de usuário pendente (ocultos até a curadoria decidir). */
export function storiesVisiveis(stories: import('../data/types').Story[], denuncias: import('../data/types').Denuncia[]) {
  return storiesAtivos(stories).filter((s) => !denuncias.some((d) => d.storyId === s.id && d.por === 'Usuário')) as import('../data/types').Story[];
}

/* ---------- Perfil e notificações ---------- */
export function atualizarPerfil(dados: { foto?: string; bio: string }) {
  const id = sessao(); if (!id) return;
  mudar((d) => { const u = d.usuarios[id]; if (dados.foto !== undefined) u.foto = dados.foto || undefined; u.bio = dados.bio.trim().slice(0, 160) || undefined; });
}

export const marcarLidas = () => { const id = sessao(); if (id) mudar((d) => { d.notificacoes.forEach((n) => { if (n.userId === id) n.lida = true; }); }); };

/* ---------- Cadastro assistido (equipe Celus no local) ---------- */
export function criarAnuncioAssistido(a: Parameters<typeof criarAnuncio>[0], anfitriao: { nome: string; email: string }): { ok: true; codigo: string } | { ok: false; erro: string } {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  if (!d0.usuarios[uid]?.equipeCelus) return { ok: false, erro: 'Só a equipe Celus faz cadastro assistido.' };
  const email = anfitriao.email.trim().toLowerCase();
  if (anfitriao.nome.trim().length < 2) return { ok: false, erro: 'Informe o nome do anfitrião.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'Informe o e-mail do anfitrião.' };
  const codigo = 'CEL-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  mudar((d) => {
    d.anuncios.push({ ...a, id: novoId(), donoId: uid, status: 'convite', notaQualidade: 5, notaCustoBeneficio: 5, totalAvaliacoes: 0, totalSonhos: 0, criadoEm: Date.now(), convite: { nome: anfitriao.nome.trim(), email, codigo, porId: uid, t: Date.now() } });
    const dono = Object.values(d.usuarios).find((x) => x.email === email);
    if (dono) notificar(d, dono.id, `A equipe Celus cadastrou um anúncio para você. Confira e assuma no Rentabilizar.`, '/renda');
  });
  return { ok: true, codigo };
}

/** O anfitrião confere o cadastro feito pela equipe, aceita as regras e passa a ser o dono. Já entra no mapa (a equipe esteve no local). */
export function assumirAnuncio(codigoOuId: string): Resultado {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return falha('Entre na sua conta.');
  if (semFoto()) return falha(SEM_FOTO);
  const alvo = codigoOuId.trim().toUpperCase();
  const a = d0.anuncios.find((x) => x.status === 'convite' && (x.convite?.codigo === alvo || x.id === codigoOuId));
  if (!a || !a.convite) return falha('Código não encontrado. Confira com quem fez o cadastro.');
  mudar((d) => {
    const x = d.anuncios.find((y) => y.id === a.id)!;
    const por = x.convite!.porId;
    x.donoId = uid; x.status = 'aprovado'; x.convite = { ...x.convite!, aceitoEm: Date.now() };
    notificar(d, por, `${d.usuarios[uid]?.nome.split(' ')[0] ?? 'O anfitrião'} assumiu ${x.titulo}. Já está no mapa.`, '/renda');
  });
  return { ok: true };
}

/* ---------- Ingressos de eventos ---------- */
const codIngresso = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const centavos = (v: number) => Math.round(v * 100) / 100;

export type ItemCompra = { loteId: string; inteira: number; meia: number };

export function comprarIngressos(a: Anuncio, itens: ItemCompra[], pagamento: Pagamento = 'pix', declaraMeia = false): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  if (semFoto()) return { ok: false, erro: SEM_FOTO };
  if (!a.evento || a.evento.cancelado) return { ok: false, erro: 'Este evento não está vendendo ingressos.' };
  if (Date.now() > a.evento.fim) return { ok: false, erro: 'Este evento já aconteceu.' };
  const total = itens.reduce((s, i) => s + i.inteira + i.meia, 0);
  if (!total) return { ok: false, erro: 'Escolha pelo menos um ingresso.' };
  if (total > MAX_INGRESSOS_COMPRA) return { ok: false, erro: `No máximo ${MAX_INGRESSOS_COMPRA} ingressos por compra.` };
  if (itens.some((i) => i.meia > 0) && !declaraMeia) return { ok: false, erro: 'Para meia-entrada, confirme que vai apresentar o documento na entrada.' };
  for (const i of itens) {
    const l = a.lotes?.find((x) => x.id === i.loteId);
    if (!l) return { ok: false, erro: 'Lote não encontrado.' };
    if (i.meia && !l.meia) return { ok: false, erro: `${l.nome} não tem meia-entrada.` };
    if (l.vendidos + i.inteira + i.meia > l.qtd) return { ok: false, erro: `${l.nome}: só restam ${l.qtd - l.vendidos}.` };
  }
  const ingressos: Ingresso[] = [];
  for (const i of itens) {
    const l = a.lotes!.find((x) => x.id === i.loteId)!;
    for (let k = 0; k < i.inteira; k++) ingressos.push({ codigo: codIngresso(), loteId: l.id, loteNome: l.nome, meia: false, valor: l.preco });
    for (let k = 0; k < i.meia; k++) ingressos.push({ codigo: codIngresso(), loteId: l.id, loteNome: l.nome, meia: true, valor: centavos(l.preco / 2) });
  }
  const subtotal = centavos(ingressos.reduce((s, i) => s + i.valor, 0));
  const taxa = centavos(subtotal * TAXA_INGRESSO);
  const id = novoId();
  mudar((d) => {
    const x = d.anuncios.find((y) => y.id === a.id)!;
    for (const i of itens) { const l = x.lotes!.find((y) => y.id === i.loteId)!; l.vendidos += i.inteira + i.meia; }
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'ingresso', status: 'confirmada', inicio: a.evento!.inicio, fimEvento: a.evento!.fim, pessoas: ingressos.length, extras: [], extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: taxa, multa: 0, total: centavos(subtotal + taxa), codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: true, criadoEm: Date.now(), comissao: 0, pagamento, ingressos });
    d.usuarios[uid].ultimoPagamento = pagamento;
    notificar(d, uid, `${ingressos.length} ingresso${ingressos.length > 1 ? 's' : ''} para ${a.titulo}. Estão no seu perfil.`, `/reserva/${id}`);
    notificar(d, a.donoId, `Venda: ${ingressos.length} ingresso${ingressos.length > 1 ? 's' : ''} de ${a.titulo}.`, '/renda');
  });
  return { ok: true, id };
}

/** Portaria do evento: o organizador digita o código do ingresso. Cada código vale uma vez. */
export function validarIngresso(anuncioId: string, digitado: string): { ok: true; nome: string; meia: boolean; lote: string } | { ok: false; erro: string } {
  const d0 = ler(); const uid = d0.sessao;
  const a = d0.anuncios.find((x) => x.id === anuncioId); if (!a) return { ok: false, erro: 'Evento não encontrado.' };
  if (a.donoId !== uid) return { ok: false, erro: 'Só o organizador valida ingressos.' };
  const cod = digitado.trim().toUpperCase();
  const r = d0.reservas.find((x) => x.anuncioId === anuncioId && x.status !== 'cancelada' && x.ingressos?.some((i) => i.codigo === cod));
  if (!r) return { ok: false, erro: 'Ingresso não encontrado para este evento.' };
  const ing = r.ingressos!.find((i) => i.codigo === cod)!;
  if (ing.usadoEm) return { ok: false, erro: `Ingresso já usado às ${new Date(ing.usadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` };
  mudar((d) => { const x = d.reservas.find((y) => y.id === r.id)!; x.ingressos!.find((i) => i.codigo === cod)!.usadoEm = Date.now(); });
  return { ok: true, nome: d0.usuarios[r.userId]?.nome ?? 'Cliente', meia: ing.meia, lote: ing.loteNome };
}

/** Organizador cancela o evento: todo mundo recebe o valor inteiro de volta. */
export function cancelarEvento(anuncioId: string) {
  mudar((d) => {
    const a = d.anuncios.find((x) => x.id === anuncioId); if (!a || a.donoId !== d.sessao || !a.evento) return;
    a.evento.cancelado = true; a.status = 'pausado';
    for (const r of d.reservas) if (r.anuncioId === anuncioId && r.status === 'confirmada') {
      r.status = 'cancelada'; r.reembolso = r.total;
      notificar(d, r.userId, `${a.titulo} foi cancelado pelo organizador. Você recebe ${brlTxt(r.total)} de volta.`, `/reserva/${r.id}`);
    }
  });
}

/** Eventos que já terminaram: as compras viram concluídas e liberam a avaliação. */
export function concluirEventosPassados() {
  const agora = Date.now();
  if (!ler().reservas.some((r) => r.tipo === 'ingresso' && r.status === 'confirmada' && (r.fimEvento ?? 0) < agora)) return;
  mudar((d) => { for (const r of d.reservas) if (r.tipo === 'ingresso' && r.status === 'confirmada' && (r.fimEvento ?? 0) < agora) { r.status = 'concluida'; r.fim = r.fimEvento; } });
}
