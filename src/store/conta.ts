// Contas no servidor (Supabase): cadastro, login, perfil, verificação de identidade e exclusão.
// O resto do app continua lendo o usuário do banco local (db.ts); aqui o perfil do servidor é copiado para lá.
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../data/types';
import { ganhar, ler, mudar } from './db';

export const noServidor = !!supabase;
type Res = { ok: true } | { ok: false; erro: string };
const falha = (erro: string): { ok: false; erro: string } => ({ ok: false, erro });

const ERROS: [RegExp, string][] = [
  [/already registered|already exists/i, 'Já existe uma conta com este e-mail. Entre com sua senha.'],
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/password should be|weak password/i, 'Escolha uma senha mais forte, com pelo menos 8 caracteres.'],
  [/rate limit|too many/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
  [/database error saving new user/i, 'Não foi possível criar a conta. Confira a data de nascimento e o aceite dos termos.'],
];
const traduzir = (m?: string) => ERROS.find(([r]) => r.test(m ?? ''))?.[1] ?? 'Não deu certo agora. Confira sua conexão e tente de novo.';

/** Copia o perfil do servidor para o banco local e abre a sessão. Conta nova ganha as boas-vindas. */
async function carregarPerfil(user: User): Promise<Res> {
  const sb = supabase!;
  const [{ data: p, error }, { data: priv }] = await Promise.all([
    sb.from('perfis').select('id, nome, foto_url, bio, verificacao, equipe, album_publico, privacidade, criado_em').eq('id', user.id).single(),
    sb.from('perfis_privados').select('nascimento').eq('id', user.id).maybeSingle(),
  ]);
  if (error || !p) return falha(traduzir(error?.message));
  mudar((d) => {
    const ant = d.usuarios[p.id];
    const u: Usuario = {
      ...ant, id: p.id, nome: p.nome, email: user.email ?? '', senhaHash: '', nascimento: priv?.nascimento ?? ant?.nascimento ?? '',
      verificacao: p.verificacao, equipeCelus: p.equipe, albumPublico: p.album_publico, privacidade: p.privacidade,
      foto: p.foto_url ?? undefined, bio: p.bio ?? undefined, criadoEm: ant?.criadoEm ?? new Date(p.criado_em).getTime(),
    };
    d.usuarios[p.id] = u;
    d.sessao = p.id;
    if (!ant) ganhar(d, p.id, 'boasvindas', 'Boas-vindas à Celus');
  });
  return { ok: true };
}

/** Liga o app à sessão do servidor. Chamado uma vez, quando o app abre. */
export function iniciarConta() {
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) carregarPerfil(data.session.user);
    else if (ler().sessao) mudar((d) => { d.sessao = null; });
  });
  supabase.auth.onAuthStateChange((ev, s) => {
    if (ev === 'SIGNED_OUT') mudar((d) => { d.sessao = null; });
    if (ev === 'PASSWORD_RECOVERY' && !location.pathname.startsWith('/nova-senha')) location.assign('/nova-senha');
    if ((ev === 'SIGNED_IN' || ev === 'USER_UPDATED') && s && ler().sessao !== s.user.id) carregarPerfil(s.user);
  });
}

/** Cadastro. Se o projeto pede confirmação de e-mail, a conta só abre depois do link. */
export async function cadastrarServidor(dados: { nome: string; email: string; senha: string; nascimento: string }): Promise<{ ok: true; confirmar: boolean } | { ok: false; erro: string }> {
  const { data, error } = await supabase!.auth.signUp({
    email: dados.email, password: dados.senha,
    options: { data: { nome: dados.nome.trim(), nascimento: dados.nascimento, aceite: true }, emailRedirectTo: location.origin + '/verificar' },
  });
  if (error) return falha(traduzir(error.message));
  if (data.user && data.user.identities?.length === 0) return falha(ERROS[0][1]);
  if (!data.session || !data.user) return { ok: true, confirmar: true };
  const r = await carregarPerfil(data.user);
  return r.ok ? { ok: true, confirmar: false } : r;
}

export async function entrarServidor(email: string, senha: string): Promise<Res> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) return falha(traduzir(error?.message));
  return carregarPerfil(data.user);
}

export async function sairServidor() {
  await supabase!.auth.signOut();
  mudar((d) => { d.sessao = null; });
}

export async function esqueciSenha(email: string): Promise<Res> {
  const { error } = await supabase!.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + '/nova-senha' });
  return error ? falha(traduzir(error.message)) : { ok: true };
}

export async function trocarSenha(senha: string): Promise<Res> {
  if (senha.length < 8) return falha('A senha precisa ter pelo menos 8 caracteres.');
  const { error } = await supabase!.auth.updateUser({ password: senha });
  return error ? falha(traduzir(error.message)) : { ok: true };
}

/** Envia uma imagem (data URL) para o armazenamento, na pasta da pessoa. Retorna o caminho. */
async function enviarImagem(bucket: 'fotos' | 'documentos', nome: string, dataUrl: string): Promise<string> {
  const uid = ler().sessao!;
  const blob = await (await fetch(dataUrl)).blob();
  const caminho = `${uid}/${nome}-${Date.now()}.jpg`;
  const { error } = await supabase!.storage.from(bucket).upload(caminho, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return caminho;
}
const urlPublica = (caminho: string) => supabase!.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;

async function recarregar(): Promise<Res> {
  const { data } = await supabase!.auth.getUser();
  return data.user ? carregarPerfil(data.user) : falha('Entre na sua conta.');
}

/** Documento e selfie vão para a curadoria. A selfie vira a foto do perfil. */
export async function enviarDocumentoServidor(doc: string, selfie: string): Promise<Res> {
  try {
    const [docPath, selfiePath] = await Promise.all([enviarImagem('documentos', 'documento', doc), enviarImagem('fotos', 'selfie', selfie)]);
    const { error } = await supabase!.rpc('pedir_verificacao', { doc: docPath, selfie: urlPublica(selfiePath) });
    if (error) return falha(traduzir(error.message));
    return recarregar();
  } catch (e) { return falha(traduzir((e as Error).message)); }
}

/** Bio e foto. Foto nova (selfie) volta para a análise da curadoria. */
export async function atualizarPerfilServidor(dados: { foto?: string; bio: string }): Promise<Res> {
  try {
    const mudanca: Record<string, unknown> = { bio: dados.bio.trim().slice(0, 160) || null };
    if (dados.foto?.startsWith('data:')) mudanca.foto_url = urlPublica(await enviarImagem('fotos', 'selfie', dados.foto));
    const { error } = await supabase!.from('perfis').update(mudanca).eq('id', ler().sessao!);
    if (error) return falha(traduzir(error.message));
    return recarregar();
  } catch (e) { return falha(traduzir((e as Error).message)); }
}

/** Privacidade do perfil e álbum dos sonhos: o app já mudou no aparelho; aqui grava no servidor. */
export function salvarPreferencias() {
  const u = ler().usuarios[ler().sessao ?? ''];
  if (!supabase || !u) return;
  supabase.from('perfis').update({ privacidade: u.privacidade, album_publico: u.albumPublico }).eq('id', u.id).then(() => {});
}

/** Exclui a conta: confere a senha, apaga as fotos e o documento e remove a conta no servidor. */
export async function excluirContaServidor(senha: string): Promise<Res> {
  const sb = supabase!;
  const u = ler().usuarios[ler().sessao ?? ''];
  if (!u) return falha('Entre na sua conta.');
  const { error: e1 } = await sb.auth.signInWithPassword({ email: u.email, password: senha });
  if (e1) return falha('Senha incorreta.');
  for (const bucket of ['fotos', 'documentos']) {
    const { data } = await sb.storage.from(bucket).list(u.id);
    if (data?.length) await sb.storage.from(bucket).remove(data.map((f) => `${u.id}/${f.name}`));
  }
  const { error } = await sb.rpc('excluir_minha_conta');
  if (error) return falha(traduzir(error.message));
  await sb.auth.signOut();
  return { ok: true };
}

/* ---------- Curadoria: identidades para conferir ---------- */
export type PedidoVerificacao = { id: string; nome: string; foto?: string; doc?: string };
export async function verificacoesPendentes(): Promise<PedidoVerificacao[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('perfis').select('id, nome, foto_url, doc_path').eq('verificacao', 'em_analise').order('criado_em');
  return Promise.all((data ?? []).map(async (p) => ({
    id: p.id, nome: p.nome, foto: p.foto_url ?? undefined,
    doc: p.doc_path ? (await supabase!.storage.from('documentos').createSignedUrl(p.doc_path, 600)).data?.signedUrl : undefined,
  })));
}
export async function decidirVerificacao(id: string, aprovar: boolean): Promise<Res> {
  const { error } = await supabase!.rpc('decidir_verificacao', { alvo: id, aprovar });
  return error ? falha(traduzir(error.message)) : { ok: true };
}
