import pool from './db.js';

// Estrutura nova do Lyonk. Roda ao iniciar o servidor e é idempotente:
// só cria tabelas/colunas que faltam e nunca apaga dados. Lançamentos antigos mantêm o significado
// (receitas antigas continuam contando no saldo; despesas pagas sem valor_pago usam o valor original).
const PASSOS = [
  // Perfil
  `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gerar_fixas_auto boolean DEFAULT true`,
  `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_concluido boolean DEFAULT false`,
  `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS modo_empresa boolean DEFAULT false`,
  `ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS cancela_no_fim boolean DEFAULT false`,

  // Contas e carteiras
  `CREATE TABLE IF NOT EXISTS public.contas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text NOT NULL,
    tipo text NOT NULL DEFAULT 'corrente',
    escopo text NOT NULL DEFAULT 'pessoal',
    saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
    cor text,
    ativo boolean NOT NULL DEFAULT true,
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contas_user ON public.contas(user_id)`,

  // Cartões de crédito
  `CREATE TABLE IF NOT EXISTS public.cartoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text NOT NULL,
    bandeira text,
    limite numeric(14,2),
    dia_fechamento integer NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    conta_pagamento_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
    escopo text NOT NULL DEFAULT 'pessoal',
    cor text,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cartoes_user ON public.cartoes(user_id)`,

  // Transferências entre contas
  `CREATE TABLE IF NOT EXISTS public.transferencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    origem_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
    destino_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
    valor numeric(14,2) NOT NULL CHECK (valor > 0),
    data date NOT NULL,
    descricao text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transferencias_user ON public.transferencias(user_id)`,

  // Despesas: conta, cartão, pagamento real, importação e escopo (pessoal/empresa)
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL`,
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL`,
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_compra date`,
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS valor_pago numeric(14,2)`,
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS import_id text`,
  `ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'pessoal'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_import ON public.despesas(user_id, import_id) WHERE import_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_despesas_venc ON public.despesas(user_id, data_vencimento)`,

  // Receitas: "pendente" marca o que ainda vai entrar (as antigas ficam como recebidas)
  `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL`,
  `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS pendente boolean NOT NULL DEFAULT false`,
  `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS recorrente_id uuid`,
  `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS import_id text`,
  `ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'pessoal'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_receitas_import ON public.receitas(user_id, import_id) WHERE import_id IS NOT NULL`,

  // Receitas recorrentes (salário, aluguel recebido...)
  `CREATE TABLE IF NOT EXISTS public.receitas_recorrentes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    descricao text NOT NULL,
    valor numeric(14,2) NOT NULL,
    dia integer NOT NULL CHECK (dia BETWEEN 1 AND 31),
    categoria text DEFAULT 'Outros',
    conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
    escopo text NOT NULL DEFAULT 'pessoal',
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // Registro de meses já gerados automaticamente (fixas e recorrentes)
  `CREATE TABLE IF NOT EXISTS public.geracoes_mensais (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ano integer NOT NULL,
    mes integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ano, mes)
  )`,

  // Regras de categoria para importação ("UBER" → Transporte)
  `CREATE TABLE IF NOT EXISTS public.regras_categoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    termo text NOT NULL,
    categoria text NOT NULL,
    tipo text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // Orçamentos mensais por categoria
  `CREATE TABLE IF NOT EXISTS public.orcamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    categoria text NOT NULL,
    valor numeric(14,2) NOT NULL CHECK (valor > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, categoria)
  )`,

  // Metas e aportes
  `CREATE TABLE IF NOT EXISTS public.metas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text NOT NULL,
    valor_alvo numeric(14,2) NOT NULL CHECK (valor_alvo > 0),
    prazo date,
    cor text,
    concluida boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS public.metas_aportes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_id uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    valor numeric(14,2) NOT NULL,
    data date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // Comprovantes anexados (guardados no próprio banco, já comprimidos pelo app)
  `CREATE TABLE IF NOT EXISTS public.anexos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    despesa_id uuid REFERENCES public.despesas(id) ON DELETE CASCADE,
    receita_id uuid REFERENCES public.receitas(id) ON DELETE CASCADE,
    nome text NOT NULL,
    mime text NOT NULL,
    tamanho integer NOT NULL,
    conteudo bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_anexos_despesa ON public.anexos(despesa_id)`,

  // Notificações no aparelho (Web Push)
  `CREATE TABLE IF NOT EXISTS public.push_inscricoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    aparelho text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS public.alertas_enviados (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chave text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, chave)
  )`,

  // Conta compartilhada
  `CREATE TABLE IF NOT EXISTS public.compartilhamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dono_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    membro_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    permissao text NOT NULL DEFAULT 'editar',
    status text NOT NULL DEFAULT 'pendente',
    token text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dono_id, email)
  )`,

  // Integração Meu Pluggy (uso pessoal do dono configurado no servidor)
  `CREATE TABLE IF NOT EXISTS public.pluggy_vinculos (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pluggy_account_id text NOT NULL,
    item_id text NOT NULL,
    nome text,
    tipo text,
    conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
    cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL,
    saldo numeric(14,2),
    atualizado_em timestamptz,
    PRIMARY KEY (user_id, pluggy_account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS public.pluggy_estado (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ultima_sync timestamptz,
    ultimo_resultado text,
    ultimo_erro text
  )`,
];

export async function garantirEsquema() {
  const client = await pool.connect();
  try {
    for (const sql of PASSOS) await client.query(sql);
    console.log(`[Esquema] ${PASSOS.length} verificações concluídas.`);
  } finally {
    client.release();
  }
}
