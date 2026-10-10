-- Celus: contas, perfil, verificação de identidade e fotos.
-- Rodar depois do 0001_init.sql. Supabase: SQL Editor > colar e executar.

-- Perfil público: só o que outras pessoas podem ver.
alter table public.perfis drop column if exists maior_de_idade;
alter table public.perfis drop column if exists documento_verificado;
alter table public.perfis
  add column if not exists verificacao text not null default 'nao_enviado' check (verificacao in ('nao_enviado','em_analise','verificado','recusado')),
  add column if not exists equipe boolean not null default false,
  add column if not exists album_publico boolean not null default false,
  add column if not exists privacidade jsonb not null default '{"comunidades":true,"eventos":true,"lugares":false}',
  add column if not exists doc_path text;

-- Dados privados (LGPD): só a própria pessoa vê. Nascimento não aparece para ninguém.
create table if not exists public.perfis_privados (
  id uuid primary key references public.perfis(id) on delete cascade,
  nascimento date not null,
  aceite_termos_em timestamptz not null default now()
);
alter table public.perfis_privados enable row level security;
create policy "vê os próprios dados" on public.perfis_privados for select using (auth.uid() = id);

-- Quem é da equipe Celus (curadoria). Marcar alguém como equipe só pelo SQL Editor:
--   update public.perfis set equipe = true where id = (select id from auth.users where email = 'email@da.equipe');
create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select equipe from public.perfis where id = auth.uid()), false);
$$;

-- Cadastro: o perfil nasce junto com a conta. Menor de 18 não cria conta (conferido no servidor).
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nasc date := (new.raw_user_meta_data->>'nascimento')::date;
begin
  if nasc is null or nasc > (current_date - interval '18 years') then
    raise exception 'A Celus é só para maiores de 18 anos.';
  end if;
  if coalesce((new.raw_user_meta_data->>'aceite')::boolean, false) is not true then
    raise exception 'É preciso aceitar os termos de uso.';
  end if;
  insert into public.perfis (id, nome) values (new.id, left(trim(coalesce(new.raw_user_meta_data->>'nome', '')), 80));
  insert into public.perfis_privados (id, nascimento) values (new.id, nasc);
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

-- A pessoa só edita bio, foto, privacidade e álbum. Verificação e equipe ficam fora do alcance dela.
drop policy if exists "cria o próprio perfil" on public.perfis;
revoke insert, update on public.perfis from anon, authenticated;
grant update (bio, foto_url, privacidade, album_publico) on public.perfis to authenticated;

-- Trocar a foto exige nova checagem (a foto do perfil é sempre o rosto da pessoa).
create or replace function public.foto_nova_reverifica() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.foto_url is distinct from old.foto_url and old.verificacao = 'verificado' and not public.eh_equipe() then
    new.verificacao := 'em_analise';
  end if;
  return new;
end $$;
drop trigger if exists ao_trocar_foto on public.perfis;
create trigger ao_trocar_foto before update on public.perfis for each row execute function public.foto_nova_reverifica();

-- Envio de documento e selfie: o perfil vai para análise.
create or replace function public.pedir_verificacao(doc text, selfie text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if split_part(doc, '/', 1) <> auth.uid()::text then raise exception 'Documento inválido.'; end if;
  update public.perfis set doc_path = doc, foto_url = selfie, verificacao = 'em_analise' where id = auth.uid();
end $$;

-- Curadoria aprova ou recusa a identidade.
create or replace function public.decidir_verificacao(alvo uuid, aprovar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_equipe() then raise exception 'Só a equipe Celus.'; end if;
  update public.perfis set verificacao = case when aprovar then 'verificado' else 'recusado' end where id = alvo;
end $$;

-- Excluir a própria conta (LGPD). Apaga perfil e dados privados em cascata.
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.pedir_verificacao(text, text), public.decidir_verificacao(uuid, boolean), public.excluir_minha_conta() from anon, public;
grant execute on function public.pedir_verificacao(text, text), public.decidir_verificacao(uuid, boolean), public.excluir_minha_conta() to authenticated;

-- Fotos: 'fotos' é pública (foto do rosto aparece para quem recebe a pessoa); 'documentos' é privada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp']),
       ('documentos', 'documentos', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Cada pessoa grava só na própria pasta (nome do arquivo começa com o id dela).
create policy "envia fotos na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "apaga as próprias fotos" on storage.objects for delete to authenticated
  using (bucket_id in ('fotos','documentos') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "envia documento na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documento: a pessoa e a equipe veem" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_equipe()));
