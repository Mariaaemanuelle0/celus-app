-- Celus: schema inicial (etapa 1 e base das próximas)
-- Rodar no Supabase: SQL Editor > colar e executar, ou via Supabase CLI.

create extension if not exists postgis;

-- Cidades (multi-cidade desde o início)
create table public.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf char(2) not null,
  centro geography(point, 4326) not null,
  ativa boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Perfil público ligado ao usuário do Supabase Auth
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  foto_url text,
  bio text,
  documento_verificado boolean not null default false,
  maior_de_idade boolean not null default false,
  criado_em timestamptz not null default now()
);

create type public.categoria as enum ('banheiro','descanso','trabalho','ficar','eventos','imoveis','estacionamento','servicos');
create type public.tipo_preco as enum ('pacote','diaria','valor','servico');
create type public.tipo_acesso as enum ('fechadura','responsavel','presencial');
create type public.status_anuncio as enum ('pendente','aprovado','recusado','pausado');

create table public.anuncios (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.perfis(id) on delete cascade,
  cidade_id uuid references public.cidades(id),
  categoria public.categoria not null,
  subcategoria text not null,          -- ex.: vestiario, rede, carro; em servicos = nicho
  profissao text,                      -- só servicos
  titulo text not null,
  descricao text not null default '',
  bairro text,
  local geography(point, 4326) not null,
  tipo_preco public.tipo_preco not null,
  pacotes jsonb,                       -- [{"horas":1,"preco":10}, ...] para tipo_preco = pacote
  preco numeric(12,2),                 -- diária, valor ou preço do serviço
  unidade_preco text,                  -- '/h', '/visita', '/mês'...
  por_pessoa boolean not null default false,
  capacidade int not null default 1 check (capacidade > 0),
  metragem_m2 int,
  comodidades text[] not null default '{}',
  extras jsonb not null default '[]',  -- [{"nome":"Toalha","preco":3}]
  tipo_acesso public.tipo_acesso,
  responsavel_local text,
  manual_bons_modos text not null default '',
  limpeza_inclusa boolean not null default false,
  fotos text[] not null default '{}',
  status public.status_anuncio not null default 'pendente',
  nota_qualidade numeric(3,2),
  nota_custo_beneficio numeric(3,2),
  total_avaliacoes int not null default 0,
  total_sonhos int not null default 0,
  criado_em timestamptz not null default now()
);
create index anuncios_local_idx on public.anuncios using gist (local);
create index anuncios_cat_idx on public.anuncios (categoria, status);

-- Busca por raio: anúncios aprovados a até raio_m metros do ponto
create or replace function public.anuncios_perto(lat double precision, lng double precision, raio_m double precision, cat public.categoria default null)
returns table (anuncio public.anuncios, distancia_m double precision)
language sql stable as $$
  select a, st_distance(a.local, st_makepoint(lng, lat)::geography) as distancia_m
  from public.anuncios a
  where a.status = 'aprovado'
    and (cat is null or a.categoria = cat)
    and st_dwithin(a.local, st_makepoint(lng, lat)::geography, raio_m)
  order by distancia_m;
$$;

-- Visão usada pelo mapa do app: anúncios aprovados com lat/lng prontos
create or replace view public.anuncios_mapa with (security_invoker = true) as
  select a.*, st_y(a.local::geometry) as lat, st_x(a.local::geometry) as lng
  from public.anuncios a
  where a.status = 'aprovado';

-- Segurança por linha (RLS)
alter table public.cidades enable row level security;
alter table public.perfis enable row level security;
alter table public.anuncios enable row level security;

create policy "cidades visíveis" on public.cidades for select using (true);
create policy "perfis visíveis" on public.perfis for select using (true);
create policy "edita o próprio perfil" on public.perfis for update using (auth.uid() = id);
create policy "cria o próprio perfil" on public.perfis for insert with check (auth.uid() = id);

create policy "anúncios aprovados são públicos" on public.anuncios for select using (status = 'aprovado' or dono_id = auth.uid());
create policy "dono cria anúncio pendente" on public.anuncios for insert with check (dono_id = auth.uid() and status = 'pendente');
create policy "dono edita o próprio anúncio" on public.anuncios for update using (dono_id = auth.uid()) with check (dono_id = auth.uid() and status in ('pendente','pausado'));
-- Aprovação (curadoria) é feita com a chave de serviço, fora do app público.
