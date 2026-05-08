-- Função para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Schema de Autenticação e Usuários
create schema if not exists auth;

create table auth.users (
  id uuid not null default gen_random_uuid(),
  email text not null unique,
  encrypted_password text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id)
);

create trigger update_users_updated_at BEFORE
update on auth.users for EACH row
execute FUNCTION update_updated_at_column ();

-- Tabelas do sistema
create table public.categorias (
  id uuid not null default gen_random_uuid (),
  nome text not null,
  tipo text not null,
  cor text null default '#8b5cf6'::text,
  created_at timestamp with time zone not null default now(),
  user_id uuid null,
  constraint categorias_pkey primary key (id),
  constraint categorias_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint categorias_tipo_check check (
    (
      tipo = any (array['despesa'::text, 'receita'::text])
    )
  )
) TABLESPACE pg_default;
create table public.despesas (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  descricao text not null,
  valor numeric(10, 2) not null,
  categoria_id uuid null,
  data_vencimento date not null,
  pago boolean null default false,
  data_pagamento date null,
  observacoes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  tipo text null default 'variavel'::text,
  numero_parcelas integer null,
  valor_total numeric null,
  parcela_atual integer null default 1,
  is_modelo boolean null default false,
  constraint despesas_pkey primary key (id),
  constraint despesas_categoria_id_fkey foreign KEY (categoria_id) references categorias (id),
  constraint despesas_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint despesas_tipo_check check (
    (
      tipo = any (
        array['fixa'::text, 'variavel'::text, 'parcelada'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_despesas_user_id on public.despesas using btree (user_id) TABLESPACE pg_default;

create trigger update_despesas_updated_at BEFORE
update on despesas for EACH row
execute FUNCTION update_updated_at_column ();
create table public.profiles (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  display_name text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION update_updated_at_column ();
create table public.receitas (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  descricao text not null,
  valor numeric(10, 2) not null,
  categoria_id uuid null,
  data_recebimento date not null,
  recebido boolean null default false,
  observacoes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint receitas_pkey primary key (id),
  constraint receitas_categoria_id_fkey foreign KEY (categoria_id) references categorias (id),
  constraint receitas_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_receitas_user_id on public.receitas using btree (user_id) TABLESPACE pg_default;

create trigger update_receitas_updated_at BEFORE
update on receitas for EACH row
execute FUNCTION update_updated_at_column ();
create table public.subscribers (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  email text not null,
  stripe_customer_id text null,
  subscribed boolean not null default false,
  subscription_tier text null,
  subscription_end timestamp with time zone null,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  display_name text null,
  constraint subscribers_pkey primary key (id),
  constraint subscribers_email_key unique (email),
  constraint subscribers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
create table public.support_messages (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  user_email text not null,
  user_name text null,
  subject text not null,
  description text not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint support_messages_pkey primary key (id),
  constraint support_messages_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null
) TABLESPACE pg_default;

create trigger update_support_messages_updated_at BEFORE
update on support_messages for EACH row
execute FUNCTION update_updated_at_column ();
