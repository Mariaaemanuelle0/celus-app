import type { Anuncio, Extra, Pacote, Reserva } from '../data/types';
import { distanciaKm, type Ponto } from '../lib/geo';
import {
  CHAT_MS, IDADE_MINIMA, STORY_MS, TAXA_HORA, TAXA_SERVICO, celulaSemaforo, cobranca, idade, moderar, reembolso, slotDe,
} from '../lib/regras';
import { carteiraDe, ganhar, ler, mudar, novoId } from './db';

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
export function enviarDocumento() {
  const id = sessao(); if (!id) return;
  mudar((d) => { d.usuarios[id].verificacao = 'verificado'; });
}

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
const codigo = () => String(Math.floor(100000 + Math.random() * 900000));

export function reservarHora(a: Anuncio, pacote: Pacote, pessoas: number, extras: Extra[], inicio: number): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  const fim = inicio + pacote.horas * 3600_000;
  const erro = checarDisponibilidade(a, inicio, fim, pessoas);
  if (erro) return { ok: false, erro };
  const subtotal = pacote.preco * pessoas + extras.reduce((s, e) => s + e.preco, 0);
  const id = novoId();
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'hora', status: 'confirmada', inicio, pacote, pessoas, extras, extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: TAXA_HORA, multa: 0, total: subtotal + TAXA_HORA, codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now() });
  });
  return { ok: true, id };
}

export function reservarDiaria(a: Anuncio, checkin: number, noites: number, pessoas: number, extras: Extra[]): { ok: true; id: string } | { ok: false; erro: string } {
  const uid = sessao(); if (!uid) return { ok: false, erro: 'Entre na sua conta.' };
  const fim = checkin + noites * 86_400_000;
  if (pessoas > a.capacidade) return { ok: false, erro: `Capacidade máxima: ${a.capacidade} pessoas.` };
  const erro = checarDisponibilidade(a, checkin, fim, pessoas);
  if (erro) return { ok: false, erro };
  const subtotal = (a.preco ?? 0) * noites + extras.reduce((s, e) => s + e.preco, 0);
  const id = novoId();
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'diaria', status: 'confirmada', inicio: checkin, noites, pessoas, extras, extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: 0, multa: 0, total: subtotal, codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now() });
  });
  return { ok: true, id };
}

export function chamarProfissional(a: Anuncio, horas: number): string | null {
  const uid = sessao(); if (!uid) return null;
  const id = novoId();
  const subtotal = (a.preco ?? 0) * horas;
  mudar((d) => {
    d.reservas.unshift({ id, anuncioId: a.id, userId: uid, tipo: 'servico', status: 'solicitado', inicio: Date.now(), horasServico: horas, pessoas: 1, extras: [], extensoes: 0, minutosTeste: 0, subtotal, taxaUsuario: TAXA_SERVICO, multa: 0, total: subtotal + TAXA_SERVICO, codigo: codigo(), avaliadaPeloUsuario: false, avaliadaPeloAnfitriao: false, criadoEm: Date.now() });
  });
  return id;
}

export const avancarChamado = (id: string, status: Reserva['status']) =>
  mudar((d) => { const r = d.reservas.find((x) => x.id === id); if (r) { r.status = status; if (status === 'concluida') { r.fim = Date.now(); ganhar(d, r.userId, 'reserva', `Serviço de ${brlTxt(r.total)}`, Math.floor(r.total / 10)); } } });

export const iniciarUso = (id: string) => mudar((d) => { const r = d.reservas.find((x) => x.id === id); if (r && r.status === 'confirmada') { r.status = 'em_uso'; r.usoInicio = Date.now(); } });
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
  });
}

export function cancelar(id: string): number {
  let valor = 0;
  mudar((d) => {
    const r = d.reservas.find((x) => x.id === id); if (!r) return;
    valor = reembolso(r).valor;
    r.status = 'cancelada'; r.reembolso = valor;
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
  });
  return cod;
}

export function criarBeneficio(anuncioId: string, nome: string, custo: number) {
  mudar((d) => {
    const a = d.anuncios.find((x) => x.id === anuncioId);
    d.beneficios.push({ id: novoId(), grupo: 'local', anuncioId, nome, desc: `Em ${a?.titulo ?? 'seu espaço'}.`, custo });
  });
}

/* ---------- Anúncios (Rentabilizar) ---------- */
export function criarAnuncio(a: Omit<Anuncio, 'id' | 'donoId' | 'status' | 'notaQualidade' | 'notaCustoBeneficio' | 'totalAvaliacoes' | 'totalSonhos' | 'criadoEm'>): string | null {
  const uid = sessao(); if (!uid) return null;
  const id = novoId();
  mudar((d) => { d.anuncios.push({ ...a, id, donoId: uid, status: 'pendente', notaQualidade: 5, notaCustoBeneficio: 5, totalAvaliacoes: 0, totalSonhos: 0, criadoEm: Date.now() }); });
  return id;
}

export const decidirAnuncio = (id: string, status: 'aprovado' | 'recusado') => mudar((d) => { const a = d.anuncios.find((x) => x.id === id); if (a) a.status = status; });
export const pausarAnuncio = (id: string) => mudar((d) => { const a = d.anuncios.find((x) => x.id === id); if (a) a.status = a.status === 'pausado' ? 'aprovado' : 'pausado'; });
export const salvarAgenda = (id: string, agenda: Anuncio['agenda']) => mudar((d) => { const a = d.anuncios.find((x) => x.id === id); if (a) a.agenda = agenda; });

export { cobranca };

/** Stories no ar: dentro das 3 h e sem denúncia de usuário pendente (ocultos até a curadoria decidir). */
export function storiesVisiveis(stories: import('../data/types').Story[], denuncias: import('../data/types').Denuncia[]) {
  return storiesAtivos(stories).filter((s) => !denuncias.some((d) => d.storyId === s.id && d.por === 'Usuário')) as import('../data/types').Story[];
}
