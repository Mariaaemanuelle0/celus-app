import type { Anuncio, Encontro, Extra, Ingresso, Pacote, Reserva } from '../data/types';
import { distanciaKm, type Ponto } from '../lib/geo';
import {
  CHAT_MS, COMISSAO, COMISSAO_REDUZIDA, MAX_INGRESSOS_COMPRA, TAXA_INGRESSO, IDADE_MINIMA, LIMITE_SEM_SUPERVISAO, STORY_MS, TAXA_SERVICO,
  bloqueadoPorConferencia, celulaSemaforo, pedePagamentoPorFora, taxaUsuarioDe, cobranca, idade, jornada, moderar, precisaSupervisao, reembolso, slotDe,
} from '../lib/regras';
import { carteiraDe, devolverCelus, ganhar, ler, mudar, notificar, novoId, pagarReservado, reservarCelus, type DB } from './db';

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
    d.usuarios[id] = { id, nome: dados.nome.trim(), email, senhaHash, nascimento: dados.nascimento, verificacao: 'nao_enviado', equipeCelus: false, albumPublico: false, criadoEm: Date.now(), privacidade: { comunidades: true, eventos: true, lugares: false } };
    d.sessao = id;
    ganhar(d, id, 'boasvindas', 'Boas-vindas à Celus');
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
export function editarAnuncio(id: string, dados: DadosAnuncio, local?: Ponto) {
  mudar((d) => {
    const a = d.anuncios.find((x) => x.id === id); if (!a || a.donoId !== d.sessao) return;
    const mudouLocal = !!local && distanciaKm(local, a) > 0.03;
    const mudouVitrine = mudouLocal || a.titulo !== dados.titulo || a.descricao !== dados.descricao || JSON.stringify(a.fotos) !== JSON.stringify(dados.fotos);
    Object.assign(a, dados);
    if (local) { a.lat = local.lat; a.lng = local.lng; }
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
  if (a.evento.vendasAbrem && Date.now() < a.evento.vendasAbrem) return { ok: false, erro: 'As vendas ainda não abriram. Marque interesse para ser avisado.' };
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

/* ---------- Interesse em eventos ---------- */
/** Marca ou desmarca "Tenho interesse". Quem compra conta como "vai". */
export function alternarInteresse(anuncioId: string): boolean {
  const uid = sessao(); if (!uid) return false;
  let marcado = false;
  mudar((d) => {
    const i = d.interesses.findIndex((x) => x.userId === uid && x.anuncioId === anuncioId);
    if (i >= 0) d.interesses.splice(i, 1);
    else { d.interesses.push({ userId: uid, anuncioId, t: Date.now() }); marcado = true; }
  });
  return marcado;
}

/** Quem já comprou ingresso para o evento (não cancelado). */
export const compradoresDe = (d: { reservas: Reserva[] }, anuncioId: string) =>
  new Set(d.reservas.filter((r) => r.anuncioId === anuncioId && r.tipo === 'ingresso' && r.status !== 'cancelada').map((r) => r.userId));

/** Números do evento: quantos vão (ingressos), quantos têm interesse e quantos interessados já compraram. */
export function numerosEvento(d: { reservas: Reserva[]; interesses: { userId: string; anuncioId: string }[] }, a: Anuncio) {
  const compradores = compradoresDe(d, a.id);
  const interessados = d.interesses.filter((x) => x.anuncioId === a.id);
  const vao = (a.lotes ?? []).reduce((s, l) => s + l.vendidos, 0);
  const convertidos = interessados.filter((x) => compradores.has(x.userId)).length;
  return { vao, interesse: interessados.filter((x) => !compradores.has(x.userId)).length + (a.evento?.interesseBase ?? 0), interessadosReais: interessados.length, convertidos };
}

/** Avisos automáticos para quem marcou interesse e ainda não comprou: abertura das vendas e véspera do evento. */
export function avisosDeEventos() {
  const d0 = ler(); const agora = Date.now();
  const pendentes = d0.anuncios.filter((a) => a.evento && !a.evento.cancelado && a.status === 'aprovado' && d0.interesses.some((i) => i.anuncioId === a.id) && (
    (!a.evento.avisos?.abertura && a.evento.vendasAbrem && agora >= a.evento.vendasAbrem) ||
    (!a.evento.avisos?.vespera && a.evento.inicio - agora <= 24 * 3600_000 && a.evento.inicio > agora)));
  if (!pendentes.length) return;
  mudar((d) => {
    for (const p of pendentes) {
      const a = d.anuncios.find((x) => x.id === p.id)!; const ev = a.evento!; ev.avisos ??= {};
      const compraram = compradoresDe(d, a.id);
      const alvo = d.interesses.filter((i) => i.anuncioId === a.id && !compraram.has(i.userId)).map((i) => i.userId);
      if (!ev.avisos.abertura && ev.vendasAbrem && agora >= ev.vendasAbrem) { ev.avisos.abertura = true; alvo.forEach((u) => notificar(d, u, `Abriram as vendas de ${a.titulo}. Garanta o seu antes de virar o lote.`, `/anuncio/${a.id}`)); }
      if (!ev.avisos.vespera && ev.inicio - agora <= 24 * 3600_000 && ev.inicio > agora) { ev.avisos.vespera = true; alvo.forEach((u) => notificar(d, u, `${a.titulo} é amanhã ou hoje. Ainda dá tempo de comprar pelo app.`, `/anuncio/${a.id}`)); }
    }
  });
}

/** Organizador manda um recado para os interessados (no máximo um por dia, para não virar spam). */
export function avisarInteressados(anuncioId: string, texto: string): Resultado {
  const d0 = ler(); const uid = d0.sessao;
  const a = d0.anuncios.find((x) => x.id === anuncioId); if (!a?.evento) return falha('Evento não encontrado.');
  if (a.donoId !== uid) return falha('Só o organizador envia avisos.');
  const t = texto.trim(); if (t.length < 5) return falha('Escreva o aviso.');
  if (pedePagamentoPorFora(t) || moderar(t)) return falha('O aviso não pode ter contato, link ou pedido de pagamento fora do app.');
  if (a.evento.avisos?.ultimoManual && Date.now() - a.evento.avisos.ultimoManual < 24 * 3600_000) return falha('Você já avisou nas últimas 24 h. Dá para mandar outro amanhã.');
  mudar((d) => {
    const x = d.anuncios.find((y) => y.id === anuncioId)!; x.evento!.avisos = { ...x.evento!.avisos, ultimoManual: Date.now() };
    const compraram = compradoresDe(d, x.id);
    d.interesses.filter((i) => i.anuncioId === x.id && !compraram.has(i.userId)).forEach((i) => notificar(d, i.userId, `${x.titulo}: ${t}`, `/anuncio/${x.id}`));
  });
  return { ok: true };
}

/* ---------- Suporte ---------- */
export function abrirSuporte(reservaId: string, motivo: string, texto: string): Resultado {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return falha('Entre na sua conta.');
  const r = d0.reservas.find((x) => x.id === reservaId); if (!r || r.userId !== uid) return falha('Reserva não encontrada.');
  if (!motivo) return falha('Escolha o que aconteceu.');
  if (d0.suporte.some((s) => s.reservaId === reservaId && s.status === 'aberto')) return falha('Já existe um chamado aberto para esta reserva.');
  const t = texto.trim().slice(0, 500);
  mudar((d) => {
    d.suporte.unshift({ id: novoId(), reservaId, userId: uid, anuncioId: r.anuncioId, motivo, texto: t, t: Date.now(), status: 'aberto' });
    notificar(d, uid, 'Recebemos seu relato. A equipe Celus responde por aqui.', `/reserva/${reservaId}`);
  });
  return { ok: true };
}

/** Equipe Celus responde. Reembolso sai do valor pago e, se a falha foi de quem ofereceu, é descontado do repasse dele. */
export function resolverSuporte(id: string, resposta: string, reembolso: number): Resultado {
  const d0 = ler(); const uid = d0.sessao;
  if (!uid || !d0.usuarios[uid]?.equipeCelus) return falha('Só a equipe Celus resolve chamados.');
  const s0 = d0.suporte.find((x) => x.id === id); if (!s0) return falha('Chamado não encontrado.');
  const r0 = d0.reservas.find((x) => x.id === s0.reservaId); if (!r0) return falha('Reserva não encontrada.');
  const max = r0.total - (r0.reembolso ?? 0);
  const v = Math.max(0, Math.min(max, Math.round(reembolso * 100) / 100));
  if (resposta.trim().length < 5) return falha('Escreva a resposta para o cliente.');
  mudar((d) => {
    const s = d.suporte.find((x) => x.id === id)!; const r = d.reservas.find((x) => x.id === s.reservaId)!;
    s.status = 'resolvido'; s.resposta = resposta.trim(); s.reembolso = v; s.resolvidoEm = Date.now();
    if (v > 0) r.reembolso = (r.reembolso ?? 0) + v;
    notificar(d, s.userId, `Seu chamado foi respondido${v > 0 ? `. Reembolso de ${brlTxt(v)}` : ''}.`, `/reserva/${r.id}`);
    const a = d.anuncios.find((x) => x.id === r.anuncioId);
    if (v > 0) notificar(d, a?.donoId, `A Celus reembolsou ${brlTxt(v)} a um cliente de ${a?.titulo ?? 'seu anúncio'} depois de um relato. O valor sai do seu próximo repasse.`, '/renda');
  });
  return { ok: true };
}

/* ---------- Conta: recebimento e exclusão ---------- */
const soDigitos = (s: string) => s.replace(/\D/g, '');
function cpfValido(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function salvarRecebimento(tipo: NonNullable<import('../data/types').Usuario['recebimento']>['tipo'], chave: string, titular: string): Resultado {
  const id = sessao(); if (!id) return falha('Entre na sua conta.');
  let k = chave.trim();
  if (tipo === 'cpf') { k = soDigitos(k); if (!cpfValido(k)) return falha('CPF inválido.'); }
  if (tipo === 'cnpj') { k = soDigitos(k); if (k.length !== 14) return falha('CNPJ precisa ter 14 números.'); }
  if (tipo === 'celular') { k = soDigitos(k); if (k.length < 10 || k.length > 11) return falha('Celular com DDD, só números.'); }
  if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return falha('E-mail inválido.');
  if (tipo === 'aleatoria' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return falha('Chave aleatória inválida.');
  if (titular.trim().length < 3) return falha('Informe o nome do titular da conta.');
  mudar((d) => { d.usuarios[id].recebimento = { tipo, chave: k, titular: titular.trim() }; });
  return { ok: true };
}

/** Exclui a conta (LGPD). Pagamentos ficam guardados sem nome pelo prazo da lei; o resto é apagado. */
export async function excluirConta(senha: string): Promise<Resultado> {
  const d0 = ler(); const uid = d0.sessao; if (!uid) return falha('Entre na sua conta.');
  const u = d0.usuarios[uid];
  if (u.senhaHash !== (await hash(senha))) return falha('Senha incorreta.');
  const meus = new Set(d0.anuncios.filter((a) => a.donoId === uid).map((a) => a.id));
  const ativo = (r: Reserva) => ['confirmada', 'em_uso', 'solicitado', 'aceito', 'a_caminho', 'em_andamento'].includes(r.status);
  if (d0.reservas.some((r) => r.userId === uid && ativo(r))) return falha('Você tem reservas em andamento. Cancele ou conclua antes de excluir a conta.');
  if (d0.reservas.some((r) => meus.has(r.anuncioId) && ativo(r))) return falha('Seus anúncios têm reservas em andamento. Conclua ou cancele antes de excluir a conta.');
  mudar((d) => {
    delete d.usuarios[uid]; delete d.carteiras[uid];
    d.sonhos = d.sonhos.filter((x) => x.userId !== uid);
    d.interesses = d.interesses.filter((x) => x.userId !== uid);
    d.checkins = d.checkins.filter((x) => x.userId !== uid);
    d.curtidas = d.curtidas.filter((x) => x.userId !== uid);
    d.stories = d.stories.filter((x) => x.autorId !== uid);
    d.chat = d.chat.filter((x) => x.autorId !== uid);
    d.notificacoes = d.notificacoes.filter((x) => x.userId !== uid);
    d.semaforo = d.semaforo.map((x) => (x.userId === uid ? { ...x, userId: 'anonimo' } : x));
    d.reservas.forEach((r) => { if (r.userId === uid) { r.userId = 'conta-excluida'; r.destino = undefined; } });
    d.avaliacoes.forEach((a) => { if (a.autorId === uid) a.autorId = 'conta-excluida'; });
    d.anuncios.forEach((a) => { if (a.donoId === uid) { a.status = 'pausado'; a.donoId = 'conta-excluida'; } });
    d.suporte.forEach((s) => { if (s.userId === uid) { s.userId = 'conta-excluida'; s.texto = ''; } });
    d.sessao = null;
  });
  return { ok: true };
}

/* ---------- Comunidades e encontros ---------- */
const precisaVerificado = () => { const d = ler(); const u = d.sessao ? d.usuarios[d.sessao] : null; return !u ? 'Entre na sua conta.' : u.verificacao !== 'verificado' ? 'Verifique sua identidade para participar.' : !u.foto ? SEM_FOTO : null; };

export function alternarComunidade(id: string): Resultado {
  const uid = sessao(); if (!uid) return falha('Entre na sua conta.');
  mudar((d) => { const c = d.comunidades.find((x) => x.id === id); if (!c) return; c.membros = c.membros.includes(uid) ? c.membros.filter((x) => x !== uid) : [...c.membros, uid]; });
  return { ok: true };
}

export function criarComunidade(dados: { nome: string; atividade: string; descricao: string; regras: string; bairro: string; lat: number; lng: number }): { ok: true; id: string } | { ok: false; erro: string } {
  const e = precisaVerificado(); if (e) return { ok: false, erro: e };
  if (dados.nome.trim().length < 4) return { ok: false, erro: 'Dê um nome à comunidade.' };
  if (!dados.atividade.trim()) return { ok: false, erro: 'Qual é a atividade?' };
  const textos = `${dados.nome} ${dados.descricao} ${dados.regras}`;
  if (moderar(textos) || pedePagamentoPorFora(textos)) return { ok: false, erro: 'Tire do texto contato, link ou pedido de pagamento fora do app.' };
  const uid = sessao()!; const id = novoId();
  mudar((d) => { d.comunidades.unshift({ id, ...dados, nome: dados.nome.trim(), atividade: dados.atividade.trim(), descricao: dados.descricao.trim(), regras: dados.regras.trim(), criadorId: uid, membros: [uid], criadoEm: Date.now() }); });
  return { ok: true, id };
}

export function criarEncontro(dados: Omit<Encontro, 'id' | 'organizadorId' | 'presencas' | 'encerrado'>): Resultado {
  const e = precisaVerificado(); if (e) return falha(e);
  const uid = sessao()!;
  const c = ler().comunidades.find((x) => x.id === dados.comunidadeId); if (!c) return falha('Comunidade não encontrada.');
  if (!c.membros.includes(uid) && c.criadorId !== uid) return falha('Entre na comunidade para criar encontros.');
  if (dados.titulo.trim().length < 4) return falha('Dê um título ao encontro.');
  if (!dados.inicio || dados.inicio < Date.now()) return falha('Escolha uma data a partir de agora.');
  if (dados.caucao < 0 || dados.caucao > 500) return falha('A caução vai de 0 a 500 celus.');
  if (moderar(`${dados.titulo} ${dados.descricao}`)) return falha('Tire do texto contato ou link.');
  mudar((d) => {
    const enc: Encontro = { ...dados, id: novoId(), organizadorId: uid, presencas: [], titulo: dados.titulo.trim() };
    d.encontros.push(enc);
    c.membros.filter((m) => m !== uid).forEach((m) => notificar(d, m, `${c.nome}: novo encontro "${enc.titulo}".`, `/comunidade/${c.id}`));
  });
  return { ok: true };
}

/** Confirmar presença. Com caução, os celus ficam reservados até o encontro. */
export function confirmarEncontro(id: string): Resultado {
  const e = precisaVerificado(); if (e) return falha(e);
  const uid = sessao()!; const d0 = ler();
  const en = d0.encontros.find((x) => x.id === id); if (!en) return falha('Encontro não encontrado.');
  if (en.organizadorId === uid) return falha('Você organiza este encontro.');
  if (Date.now() > en.inicio) return falha('Este encontro já começou.');
  const ativos = en.presencas.filter((p) => p.status === 'confirmado' || p.status === 'presente');
  if (ativos.some((p) => p.userId === uid)) return falha('Você já confirmou.');
  if (ativos.length >= en.vagas) return falha('As vagas acabaram.');
  if (en.caucao > carteiraDe(d0, uid).saldo) return falha(`Você precisa de ${en.caucao} celus disponíveis para a caução.`);
  mudar((d) => {
    const x = d.encontros.find((y) => y.id === id)!;
    if (!reservarCelus(d, uid, x.caucao, x.titulo)) return;
    x.presencas = x.presencas.filter((p) => p.userId !== uid);
    x.presencas.push({ userId: uid, t: Date.now(), codigo: codigo(), status: 'confirmado' });
    notificar(d, x.organizadorId, `${d.usuarios[uid]?.nome.split(' ')[0]} confirmou presença em "${x.titulo}".`, `/comunidade/${x.comunidadeId}`);
  });
  return { ok: true };
}

/** Cancelar a presença: dentro do prazo, a caução volta; fora do prazo, vai para quem organiza. */
export function cancelarPresenca(id: string): { ok: true; perdeu: number } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  const en = ler().encontros.find((x) => x.id === id); if (!en) return { ok: false, erro: 'Encontro não encontrado.' };
  const p = en.presencas.find((x) => x.userId === uid && x.status === 'confirmado'); if (!p) return { ok: false, erro: 'Você não está confirmado.' };
  const noPrazo = en.inicio - Date.now() >= en.prazoCancelH * 3600_000;
  mudar((d) => {
    const x = d.encontros.find((y) => y.id === id)!; const q = x.presencas.find((y) => y.userId === uid && y.status === 'confirmado')!;
    q.status = 'cancelado';
    if (noPrazo) devolverCelus(d, uid, x.caucao, x.titulo);
    else { pagarReservado(d, uid, x.organizadorId, x.caucao, `cancelamento fora do prazo em "${x.titulo}"`); notificar(d, x.organizadorId, `Cancelamento fora do prazo em "${x.titulo}". Você recebeu ${x.caucao} celus.`, `/comunidade/${x.comunidadeId}`); }
  });
  return { ok: true, perdeu: noPrazo ? 0 : en.caucao };
}

/** Quem organiza confere o código de quem chegou: a caução volta para a pessoa. */
export function marcarPresenca(id: string, digitado: string, demo = false): { ok: true; nome: string } | { ok: false; erro: string } {
  const d0 = ler(); const uid = d0.sessao;
  const en = d0.encontros.find((x) => x.id === id); if (!en) return { ok: false, erro: 'Encontro não encontrado.' };
  if (demo ? !en.organizadorId.startsWith('demo-') : en.organizadorId !== uid) return { ok: false, erro: 'Só quem organiza confere a chegada.' };
  const p = en.presencas.find((x) => x.codigo === digitado.trim() && x.status === 'confirmado');
  if (!p) return { ok: false, erro: 'Código não encontrado ou já conferido.' };
  mudar((d) => {
    const x = d.encontros.find((y) => y.id === id)!; const q = x.presencas.find((y) => y.codigo === p.codigo)!;
    q.status = 'presente'; devolverCelus(d, q.userId, x.caucao, x.titulo);
    notificar(d, q.userId, x.caucao ? `Presença confirmada em "${x.titulo}". Seus ${x.caucao} celus voltaram.` : `Presença confirmada em "${x.titulo}".`, `/comunidade/${x.comunidadeId}`);
  });
  return { ok: true, nome: d0.usuarios[p.userId]?.nome ?? 'Participante' };
}

/** Encerrar: quem confirmou e não apareceu perde a caução para quem organizou. Encontros passados encerram sozinhos. */
export function encerrarEncontro(id: string) {
  mudar((d) => {
    const x = d.encontros.find((y) => y.id === id); if (!x || x.encerrado) return;
    x.encerrado = true;
    for (const p of x.presencas) if (p.status === 'confirmado') {
      p.status = 'faltou';
      pagarReservado(d, p.userId, x.organizadorId, x.caucao, `falta em "${x.titulo}"`);
      notificar(d, p.userId, x.caucao ? `Você não compareceu a "${x.titulo}". A caução de ${x.caucao} celus foi para quem organizou.` : `Você não compareceu a "${x.titulo}".`, `/comunidade/${x.comunidadeId}`);
    }
  });
}
export function encerrarEncontrosPassados() {
  const agora = Date.now();
  ler().encontros.filter((e) => !e.encerrado && agora > e.fim + 3600_000).forEach((e) => encerrarEncontro(e.id));
}

/* ---------- Trocas ---------- */
const PROIBIDOS = /(arma|muni[cç][aã]o|rem[eé]dio|medicamento|tarja|cigarro|vape|bebida alco|cerveja|vinho|animal|filhote|cachorro|gato|p[aá]ssaro|documento|chip|celular bloqueado)/i;

export function anunciarTroca(dados: { titulo: string; descricao: string; estado: 'novo' | 'usado'; preco: number; fotos: string[]; bairro: string; lat: number; lng: number }): Resultado {
  const e = precisaVerificado(); if (e) return falha(e);
  if (dados.titulo.trim().length < 3) return falha('Diga o que é o item.');
  if (!dados.fotos.length) return falha('Coloque pelo menos uma foto do item.');
  if (dados.preco < 0 || dados.preco > 5000) return falha('O valor vai de 0 (doação) a 5.000 celus.');
  const texto = `${dados.titulo} ${dados.descricao}`;
  if (PROIBIDOS.test(texto)) return falha('Esse tipo de item não pode ser trocado na Celus (armas, remédios, bebidas, cigarros, animais, documentos).');
  if (moderar(texto) || pedePagamentoPorFora(texto)) return falha('Tire do texto contato, link ou pedido de pagamento fora do app.');
  const uid = sessao()!;
  mudar((d) => { d.trocas.unshift({ id: novoId(), donoId: uid, ...dados, titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), criadoEm: Date.now(), status: 'disponivel' }); });
  return { ok: true };
}

/** "Quero": os celus ficam reservados até a retirada. */
export function quererTroca(id: string): Resultado {
  const e = precisaVerificado(); if (e) return falha(e);
  const uid = sessao()!; const d0 = ler();
  const t = d0.trocas.find((x) => x.id === id); if (!t || t.status !== 'disponivel') return falha('Este item não está mais disponível.');
  if (t.donoId === uid) return falha('Este item é seu.');
  if (carteiraDe(d0, uid).saldo < t.preco) return falha(`Você precisa de ${t.preco} celus disponíveis.`);
  mudar((d) => {
    const x = d.trocas.find((y) => y.id === id)!;
    if (!reservarCelus(d, uid, x.preco, x.titulo)) return;
    x.status = 'reservado'; x.compradorId = uid; x.codigo = codigo(); x.reservadoEm = Date.now();
    notificar(d, x.donoId, `${d.usuarios[uid]?.nome.split(' ')[0]} quer "${x.titulo}". Combine a retirada e confira o código na entrega.`, `/troca/${x.id}`);
  });
  return { ok: true };
}

export function desistirTroca(id: string) {
  const uid = sessao(); if (!uid) return;
  mudar((d) => {
    const x = d.trocas.find((y) => y.id === id); if (!x || x.status !== 'reservado' || (x.compradorId !== uid && x.donoId !== uid)) return;
    devolverCelus(d, x.compradorId!, x.preco, x.titulo);
    notificar(d, x.compradorId === uid ? x.donoId : x.compradorId, `A troca de "${x.titulo}" foi desfeita.${x.preco ? ' Os celus voltaram para quem tinha reservado.' : ''}`, `/troca/${x.id}`);
    x.status = 'disponivel'; x.compradorId = undefined; x.codigo = undefined; x.reservadoEm = undefined;
  });
}

/** Na retirada, quem entrega digita o código de quem recebe: só então os celus passam. */
export function confirmarRetirada(id: string, digitado: string, demo = false): Resultado {
  const d0 = ler(); const uid = d0.sessao;
  const t = d0.trocas.find((x) => x.id === id); if (!t || t.status !== 'reservado') return falha('Nada para confirmar.');
  if (demo ? !t.donoId.startsWith('demo-') : t.donoId !== uid) return falha('Só quem entrega confere o código.');
  if (digitado.trim() !== t.codigo) return falha('Código errado.');
  mudar((d) => {
    const x = d.trocas.find((y) => y.id === id)!;
    pagarReservado(d, x.compradorId!, x.donoId, x.preco, `troca de "${x.titulo}"`);
    x.status = 'entregue'; x.entregueEm = Date.now();
    notificar(d, x.compradorId, `Retirada de "${x.titulo}" confirmada. Bom proveito!`, `/troca/${x.id}`);
    notificar(d, x.donoId, x.preco ? `Você recebeu ${x.preco} celus por "${x.titulo}".` : `Doação de "${x.titulo}" concluída. Obrigado por dar outra vida ao item.`, `/troca/${x.id}`);
  });
  return { ok: true };
}

export const removerTroca = (id: string) => mudar((d) => { const x = d.trocas.find((y) => y.id === id); if (x && x.donoId === d.sessao && x.status === 'disponivel') x.status = 'removido'; });
export const denunciarTroca = (id: string) => mudar((d) => { const x = d.trocas.find((y) => y.id === id); if (x) { x.denuncias = (x.denuncias ?? 0) + 1; if (x.denuncias >= 3 && x.status === 'disponivel') x.status = 'removido'; } });

/* ---------- Privacidade do perfil ---------- */
export const alternarPrivacidade = (bloco: 'comunidades' | 'eventos' | 'lugares') => { const id = sessao(); if (id) mudar((d) => { const u = d.usuarios[id]; const p = u.privacidade ?? { comunidades: true, eventos: true, lugares: false }; u.privacidade = { ...p, [bloco]: !p[bloco] }; }); };
