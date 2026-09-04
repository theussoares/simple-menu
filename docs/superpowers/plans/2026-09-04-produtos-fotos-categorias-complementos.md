# Produtos: fotos, categorias e complementos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o campo de URL de imagem por upload com otimização automática para WebP, transformar categoria em entidade gerenciável, e adicionar grupos de complementos reaproveitáveis entre produtos.

**Architecture:** Duas migrations novas (schema + storage bucket), tipos/schemas compartilhados atualizados, rotas server sob `layers/admin/server/api/admin/` seguindo o padrão `requireEstablishment` já existente, novas stores Pinia + componentes Vue no layer admin, e ajustes no layer `menu` para exibir categoria/complementos no cardápio público.

**Tech Stack:** Nuxt 4, Supabase (Postgres + Storage + RLS), Pinia, Zod, reka-ui (headless components, já uma dependência), Canvas API nativa do navegador (sem lib nova) para otimizar imagem para WebP.

**Spec:** `docs/superpowers/specs/2026-09-03-produtos-fotos-categorias-complementos-design.md`

## Global Constraints

- Não adicionar nenhuma dependência npm nova — Canvas API e reka-ui já cobrem tudo que este plano precisa.
- Copy de UI em pt-BR, consistente com o restante do admin.
- Sem framework de testes automatizado neste repo (sem vitest/jest configurado). A verificação de cada tarefa é: `pnpm exec nuxt typecheck` (sem novos erros) + exercício manual via `pnpm dev` no navegador (ou `curl` autenticado quando fizer sentido) +, para migrations, uma query `select` confirmando o resultado no banco.
- Migrations são aplicadas manualmente contra o projeto Supabase (não há `supabase/config.toml` neste repo) — via `supabase db push` se o projeto estiver linkado localmente, ou colando o SQL no SQL editor do Supabase Studio.
- RLS: sempre uma policy por operação (`select`/`insert`/`update`/`delete`), nunca `for all` — segue o padrão da migration existente.
- Limitação aceita conscientemente: se o lojista fizer upload de uma foto e cancelar o dialog sem salvar o produto, o arquivo fica no storage (órfão). Não vamos construir limpeza para esse caso — só para troca/exclusão de produto, que é o caminho comum.

### Drift descoberto no pre-flight scan (2026-09-04)

O worktree nativo foi criado a partir de `origin/<default-branch>`, que tinha 3 commits além do que o spec original leu: preço promocional (`promoPrice`/`promo_price`) e destaque (`isFeatured`/`is_featured`) em produtos, capa do estabelecimento (`coverImageUrl`/`cover_image_url`), um redesign completo do cardápio público (busca, chips de categoria, carrossel de destaques, dialog de detalhe do produto, categorias colapsáveis) e um plugin `layers/base/app/plugins/register-primitives.ts` que registra `Dialog`/`AlertDialog`/`DialogTrigger`/`DialogClose`/`AlertDialogTrigger` como componentes globais (por isso esses componentes não são mais importados explicitamente nos dialogs existentes).

**Ruling:** todo o código deste plano foi revisado para somar-se a esse trabalho, não substituí-lo — nenhuma task deve remover `promoPrice`, `isFeatured`, `coverImageUrl`, ou qualquer peça do redesign do cardápio público. Os blocos de código abaixo já refletem essa fusão. Onde uma task cria um dialog novo (`Dialog`/`AlertDialog` como raiz), ele NÃO importa `Dialog`/`AlertDialog` explicitamente — são globais via o plugin. `Tabs` (Task 10) é adicionado a esse mesmo plugin pelo mesmo motivo.

Também notado, mas fora do escopo deste plano: não existe migration para `is_featured`/`promo_price`/`cover_image_url` em `supabase/migrations/` (só a migration inicial existe), embora o código já dependa dessas colunas — sinal de que elas foram adicionadas fora do fluxo de migration versionada. Não corrigimos isso aqui; é um gap pré-existente e alheio a este plano.

---

### Task 1: Migration — categorias e grupos de complemento

**Files:**
- Create: `supabase/migrations/20260904000001_categories_and_complements.sql`

**Interfaces:**
- Produces: tabelas `categories`, `complement_groups`, `complement_options`, `product_complement_groups`; coluna `products.category_id uuid`; a coluna `products.category` (text) é removida.

- [ ] **Step 1: Escrever a migration**

```sql
-- Categories replace the free-text `products.category` field with a
-- reusable, orderable entity per establishment.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_establishment_name_key
  on public.categories (establishment_id, lower(name));
create index categories_establishment_id_idx on public.categories (establishment_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

-- Backfill: every distinct free-text category value becomes a row here,
-- then products are relinked by id before the old column is dropped.
insert into public.categories (establishment_id, name)
select distinct establishment_id, trim(category)
from public.products
where category is not null and trim(category) <> '';

alter table public.products add column category_id uuid references public.categories (id) on delete set null;

update public.products
set category_id = categories.id
from public.categories
where products.establishment_id = categories.establishment_id
  and products.category is not null
  and lower(trim(products.category)) = lower(categories.name);

alter table public.products drop column category;

create index products_category_id_idx on public.products (category_id);

-- Complement groups are reusable across products of the same establishment
-- (e.g. "Escolha o tamanho", "Adicionais"), each with a set of options that
-- carry an optional price delta.
create table public.complement_groups (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer check (max_select is null or max_select >= min_select),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index complement_groups_establishment_id_idx on public.complement_groups (establishment_id);

create trigger complement_groups_set_updated_at
  before update on public.complement_groups
  for each row
  execute function public.set_updated_at();

create table public.complement_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.complement_groups (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  price_delta numeric(10, 2) not null default 0 check (price_delta >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index complement_options_group_id_idx on public.complement_options (group_id);

create trigger complement_options_set_updated_at
  before update on public.complement_options
  for each row
  execute function public.set_updated_at();

-- Product <-> complement group link (many-to-many: a group can be reused
-- across several products of the same establishment).
create table public.product_complement_groups (
  product_id uuid not null references public.products (id) on delete cascade,
  group_id uuid not null references public.complement_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, group_id)
);

create index product_complement_groups_group_id_idx on public.product_complement_groups (group_id);

-- Row Level Security -------------------------------------------------------

alter table public.categories enable row level security;
alter table public.complement_groups enable row level security;
alter table public.complement_options enable row level security;
alter table public.product_complement_groups enable row level security;

create policy "categories_public_read" on public.categories for select
  to anon, authenticated using (true);
create policy "categories_owner_insert" on public.categories for insert
  to authenticated
  with check (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));
create policy "categories_owner_update" on public.categories for update
  to authenticated
  using (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())))
  with check (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));
create policy "categories_owner_delete" on public.categories for delete
  to authenticated
  using (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));

create policy "complement_groups_public_read" on public.complement_groups for select
  to anon, authenticated using (true);
create policy "complement_groups_owner_insert" on public.complement_groups for insert
  to authenticated
  with check (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));
create policy "complement_groups_owner_update" on public.complement_groups for update
  to authenticated
  using (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())))
  with check (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));
create policy "complement_groups_owner_delete" on public.complement_groups for delete
  to authenticated
  using (establishment_id in (select id from public.establishments where owner_id = (select auth.uid())));

create policy "complement_options_public_read" on public.complement_options for select
  to anon, authenticated using (true);
create policy "complement_options_owner_insert" on public.complement_options for insert
  to authenticated
  with check (group_id in (
    select id from public.complement_groups
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));
create policy "complement_options_owner_update" on public.complement_options for update
  to authenticated
  using (group_id in (
    select id from public.complement_groups
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ))
  with check (group_id in (
    select id from public.complement_groups
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));
create policy "complement_options_owner_delete" on public.complement_options for delete
  to authenticated
  using (group_id in (
    select id from public.complement_groups
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));

create policy "product_complement_groups_public_read" on public.product_complement_groups for select
  to anon, authenticated using (true);
create policy "product_complement_groups_owner_insert" on public.product_complement_groups for insert
  to authenticated
  with check (product_id in (
    select id from public.products
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));
create policy "product_complement_groups_owner_update" on public.product_complement_groups for update
  to authenticated
  using (product_id in (
    select id from public.products
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ))
  with check (product_id in (
    select id from public.products
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));
create policy "product_complement_groups_owner_delete" on public.product_complement_groups for delete
  to authenticated
  using (product_id in (
    select id from public.products
    where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
  ));
```

- [ ] **Step 2: Aplicar e verificar**

Aplique via `supabase db push` (se o projeto estiver linkado) ou colando o SQL no SQL editor do Supabase Studio. Depois confirme:

```sql
select id, name, sort_order from public.categories;
select count(*) from public.products where category_id is null;
```

Espera-se uma linha em `categories` para cada valor distinto que existia em `products.category`, e que produtos que tinham categoria preenchida agora tenham `category_id` não nulo.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260904000001_categories_and_complements.sql
git commit -m "Add categories and complement groups schema with backfill"
```

---

### Task 2: Migration — bucket de imagens de produto

**Files:**
- Create: `supabase/migrations/20260904000002_product_images_storage.sql`

**Interfaces:**
- Produces: bucket `product-images` público, com escrita restrita ao dono do estabelecimento via `(storage.foldername(name))[1]`.

- [ ] **Step 1: Escrever a migration**

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "product_images_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.establishments where owner_id = (select auth.uid())
    )
  );

create policy "product_images_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.establishments where owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.establishments where owner_id = (select auth.uid())
    )
  );

create policy "product_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.establishments where owner_id = (select auth.uid())
    )
  );
```

- [ ] **Step 2: Aplicar e verificar**

Aplique da mesma forma que a Task 1. Confirme no Supabase Studio (Storage) que o bucket `product-images` existe e está marcado como público.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260904000002_product_images_storage.sql
git commit -m "Add product-images storage bucket with owner-scoped RLS"
```

---

### Task 3: Tipos e schemas compartilhados

**Files:**
- Modify: `shared/types/database.types.ts`
- Modify: `shared/types/domain.ts`
- Create: `shared/types/database-relations.ts`
- Create: `shared/schemas/category.schema.ts`
- Create: `shared/schemas/complement-group.schema.ts`
- Modify: `shared/schemas/product.schema.ts`

**Interfaces:**
- Produces: `CategoryDto`, `ComplementGroupDto`, `ComplementOptionDto`, `ProductDto` (com `categoryId`/`complementGroupIds`), `PublicMenuProductDto` (com `category: {id,name}|null` e `complementGroups`), `CategoryInput`, `ComplementGroupInput`, `ProductInput` (com `categoryId`/`complementGroupIds`), tipos de linha `ProductRowWithMenuRelations`, `ProductRowWithComplementGroupIds`, `ComplementGroupRowWithOptions`.

- [ ] **Step 1: Reescrever `shared/types/database.types.ts`**

```ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      establishments: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          segment: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          segment?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          segment?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          promo_price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price: number
          promo_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          promo_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      complement_groups: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_required: boolean
          max_select: number | null
          min_select: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_required?: boolean
          max_select?: number | null
          min_select?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'complement_groups_establishment_id_fkey'
            columns: ['establishment_id']
            isOneToOne: false
            referencedRelation: 'establishments'
            referencedColumns: ['id']
          },
        ]
      }
      complement_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'complement_options_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'complement_groups'
            referencedColumns: ['id']
          },
        ]
      }
      product_complement_groups: {
        Row: {
          group_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'product_complement_groups_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_complement_groups_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'complement_groups'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals['public']

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']
```

- [ ] **Step 2: Criar `shared/types/database-relations.ts`**

Tipos das linhas retornadas por selects com `join` — o cliente Supabase deste projeto não gera tipos fortes para selects aninhados (não há geração de código via CLI), então essas formas são declaradas e usadas explicitamente onde uma rota faz um select com relacionamento.

```ts
import type { Tables } from './database.types'

export interface ProductComplementOptionRow {
  id: string
  name: string
  price_delta: number
  is_active: boolean
  sort_order: number
}

export interface ProductComplementGroupRow {
  id: string
  name: string
  is_required: boolean
  complement_options: ProductComplementOptionRow[]
}

export interface ProductRowWithMenuRelations extends Tables<'products'> {
  categories: { id: string; name: string; sort_order: number } | null
  product_complement_groups: { complement_groups: ProductComplementGroupRow }[]
}

export interface ProductRowWithComplementGroupIds extends Tables<'products'> {
  product_complement_groups: { group_id: string }[]
}

export interface ComplementGroupRowWithOptions extends Tables<'complement_groups'> {
  complement_options: Tables<'complement_options'>[]
}
```

- [ ] **Step 3: Reescrever `shared/types/domain.ts`**

```ts
export interface EstablishmentDto {
  id: string
  name: string
  slug: string
  segment: string | null
  coverImageUrl: string | null
}

export interface CategoryDto {
  id: string
  establishmentId: string
  name: string
  sortOrder: number
}

export interface ComplementOptionDto {
  id: string
  name: string
  priceDelta: number
  isActive: boolean
  sortOrder: number
}

export interface ComplementGroupDto {
  id: string
  establishmentId: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  sortOrder: number
  options: ComplementOptionDto[]
}

export interface ProductDto {
  id: string
  establishmentId: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  cost: number | null
  categoryId: string | null
  imageUrl: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  complementGroupIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PublicMenuCategoryDto {
  id: string
  name: string
}

export interface PublicMenuComplementOptionDto {
  id: string
  name: string
  priceDelta: number
}

export interface PublicMenuComplementGroupDto {
  id: string
  name: string
  isRequired: boolean
  options: PublicMenuComplementOptionDto[]
}

export interface PublicMenuProductDto {
  id: string
  name: string
  description: string | null
  price: number
  promoPrice: number | null
  category: PublicMenuCategoryDto | null
  imageUrl: string | null
  isFeatured: boolean
  complementGroups: PublicMenuComplementGroupDto[]
}

export interface PublicMenuDto {
  establishment: EstablishmentDto
  products: PublicMenuProductDto[]
}

export interface SessionUserDto {
  id: string
  email: string | null
  establishment: EstablishmentDto | null
}
```

- [ ] **Step 4: Criar `shared/schemas/category.schema.ts`**

```ts
import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const categoryIdParamSchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 5: Criar `shared/schemas/complement-group.schema.ts`**

```ts
import { z } from 'zod'

export const complementOptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceDelta: z.coerce.number().min(0).max(100_000).default(0),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
})

export const complementGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    isRequired: z.boolean().default(false),
    minSelect: z.coerce.number().int().min(0).max(50).default(0),
    maxSelect: z.coerce.number().int().min(0).max(50).nullable().default(null),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
    options: z.array(complementOptionSchema).min(1, 'Adicione ao menos uma opção.'),
  })
  .refine((data) => !data.isRequired || data.minSelect >= 1, {
    message: 'Grupos obrigatórios precisam de no mínimo 1 seleção.',
    path: ['minSelect'],
  })
  .refine((data) => data.maxSelect === null || data.maxSelect >= data.minSelect, {
    message: 'O máximo não pode ser menor que o mínimo.',
    path: ['maxSelect'],
  })

export type ComplementGroupInput = z.infer<typeof complementGroupSchema>
export type ComplementOptionInput = z.infer<typeof complementOptionSchema>

export const complementGroupIdParamSchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 6: Editar `shared/schemas/product.schema.ts`**

Preserva `promoPrice`/`isFeatured` e o `.refine` de preço promocional já existentes (de um redesign recente do cardápio) — só troca `category` (texto livre) por `categoryId` e soma `complementGroupIds`.

```ts
import { z } from 'zod'

export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    price: z.coerce.number().min(0).max(1_000_000),
    promoPrice: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    cost: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
    categoryId: z.string().uuid().nullable().default(null),
    imageUrl: z.string().trim().url().max(2048).optional().or(z.literal('')),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
    complementGroupIds: z.array(z.string().uuid()).default([]),
  })
  .refine((data) => data.promoPrice == null || data.promoPrice < data.price, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['promoPrice'],
  })

export type ProductInput = z.infer<typeof productSchema>

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
})
```

- [ ] **Step 7: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: erros apontando para os lugares que ainda usam `product.category`/`row.category` (serão corrigidos nas próximas tasks) — nenhum erro dentro dos arquivos desta task.

- [ ] **Step 8: Commit**

```bash
git add shared/types/database.types.ts shared/types/domain.ts shared/types/database-relations.ts shared/schemas/category.schema.ts shared/schemas/complement-group.schema.ts shared/schemas/product.schema.ts
git commit -m "Update shared types and schemas for categories and complement groups"
```

---

### Task 4: Utils de servidor — mappers, limpeza de imagem, sincronização de complementos

**Files:**
- Modify: `layers/base/server/utils/mappers.ts`
- Create: `layers/base/server/utils/product-images.ts`
- Create: `layers/base/server/utils/product-complement-groups.ts`

**Interfaces:**
- Consumes: `Tables`, `ComplementGroupRowWithOptions`, `ProductRowWithMenuRelations` de `#shared/types/database.types` e `#shared/types/database-relations`; `CategoryDto`, `ComplementGroupDto`, `EstablishmentDto`, `ProductDto`, `PublicMenuProductDto` de `#shared/types/domain`.
- Produces: `toEstablishmentDto(row)` (preservada, já existia), `toProductDto(row, complementGroupIds)`, `toPublicMenuProductDto(row)`, `toCategoryDto(row)`, `toComplementGroupDto(row)`, `deleteProductImageIfOwned(client, imageUrl)`, `extractProductImagePath(imageUrl)`, `syncProductComplementGroups(client, establishmentId, productId, requestedGroupIds)`.

- [ ] **Step 1: Reescrever `layers/base/server/utils/mappers.ts`**

Preserva `toEstablishmentDto` e os campos `promoPrice`/`isFeatured` já existentes neste arquivo (de um redesign recente do cardápio) — só soma `categoryId`/`complementGroupIds`/`category`/`complementGroups` e as duas novas funções de mapper.

```ts
import type { Tables } from '#shared/types/database.types'
import type { ComplementGroupRowWithOptions, ProductRowWithMenuRelations } from '#shared/types/database-relations'
import type {
  CategoryDto,
  ComplementGroupDto,
  EstablishmentDto,
  ProductDto,
  PublicMenuProductDto,
} from '#shared/types/domain'

export function toEstablishmentDto(row: Tables<'establishments'>): EstablishmentDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    segment: row.segment,
    coverImageUrl: row.cover_image_url,
  }
}

export function toProductDto(row: Tables<'products'>, complementGroupIds: string[]): ProductDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    cost: row.cost === null ? null : Number(row.cost),
    categoryId: row.category_id,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    complementGroupIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPublicMenuProductDto(row: ProductRowWithMenuRelations): PublicMenuProductDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    promoPrice: row.promo_price === null ? null : Number(row.promo_price),
    category: row.categories ? { id: row.categories.id, name: row.categories.name } : null,
    imageUrl: row.image_url,
    isFeatured: row.is_featured,
    complementGroups: row.product_complement_groups
      .map((link) => link.complement_groups)
      .map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.is_required,
        options: group.complement_options
          .filter((option) => option.is_active)
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((option) => ({ id: option.id, name: option.name, priceDelta: Number(option.price_delta) })),
      }))
      .filter((group) => group.options.length > 0),
  }
}

export function toCategoryDto(row: Tables<'categories'>): CategoryDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    sortOrder: row.sort_order,
  }
}

export function toComplementGroupDto(row: ComplementGroupRowWithOptions): ComplementGroupDto {
  return {
    id: row.id,
    establishmentId: row.establishment_id,
    name: row.name,
    isRequired: row.is_required,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    sortOrder: row.sort_order,
    options: row.complement_options
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.price_delta),
        isActive: option.is_active,
        sortOrder: option.sort_order,
      })),
  }
}
```

- [ ] **Step 2: Criar `layers/base/server/utils/product-images.ts`**

`logServerError` não é importado explicitamente — é um util do mesmo diretório `server/utils`, auto-importado pelo Nitro, seguindo o padrão já usado em `require-establishment.ts`.

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

const PUBLIC_URL_MARKER = '/storage/v1/object/public/product-images/'

/** Returns the storage path for a product image URL, or null if it wasn't uploaded to our bucket (e.g. a legacy external URL). */
export function extractProductImagePath(imageUrl: string): string | null {
  const index = imageUrl.indexOf(PUBLIC_URL_MARKER)
  if (index === -1) return null
  return imageUrl.slice(index + PUBLIC_URL_MARKER.length)
}

export async function deleteProductImageIfOwned(client: SupabaseClient<Database>, imageUrl: string | null) {
  if (!imageUrl) return
  const path = extractProductImagePath(imageUrl)
  if (!path) return

  const { error } = await client.storage.from('product-images').remove([path])
  if (error) logServerError('product-images.delete', error)
}
```

- [ ] **Step 3: Criar `layers/base/server/utils/product-complement-groups.ts`**

```ts
import { createError } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

/**
 * Replaces a product's linked complement groups, silently dropping any id
 * that isn't a group owned by this establishment (defends against a
 * cross-establishment id slipping through, since RLS on the join table only
 * checks product ownership, not group ownership).
 */
export async function syncProductComplementGroups(
  client: SupabaseClient<Database>,
  establishmentId: string,
  productId: string,
  requestedGroupIds: string[],
): Promise<string[]> {
  let validGroupIds: string[] = []

  if (requestedGroupIds.length > 0) {
    const { data: ownedGroups, error: ownedGroupsError } = await client
      .from('complement_groups')
      .select('id')
      .eq('establishment_id', establishmentId)
      .in('id', requestedGroupIds)

    if (ownedGroupsError) {
      logServerError('product-complement-groups.validate', ownedGroupsError)
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível validar os complementos.' })
    }

    validGroupIds = ownedGroups.map((group) => group.id)
  }

  const { error: deleteError } = await client.from('product_complement_groups').delete().eq('product_id', productId)
  if (deleteError) {
    logServerError('product-complement-groups.clear', deleteError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar os complementos do produto.' })
  }

  if (validGroupIds.length > 0) {
    const { error: insertError } = await client
      .from('product_complement_groups')
      .insert(validGroupIds.map((groupId, index) => ({ product_id: productId, group_id: groupId, sort_order: index })))

    if (insertError) {
      logServerError('product-complement-groups.insert', insertError)
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar os complementos do produto.' })
    }
  }

  return validGroupIds
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: os erros restantes devem estar só nas rotas que ainda não foram atualizadas (Tasks 5, 6, 8, 9) — nada dentro dos três arquivos desta task.

- [ ] **Step 5: Commit**

```bash
git add layers/base/server/utils/mappers.ts layers/base/server/utils/product-images.ts layers/base/server/utils/product-complement-groups.ts
git commit -m "Add category/complement-group mappers and product-image cleanup util"
```

---

### Task 5: Rotas de categorias

**Files:**
- Create: `layers/admin/server/api/admin/categories/index.get.ts`
- Create: `layers/admin/server/api/admin/categories/index.post.ts`
- Create: `layers/admin/server/api/admin/categories/[id].patch.ts`
- Create: `layers/admin/server/api/admin/categories/[id].delete.ts`

**Interfaces:**
- Consumes: `requireEstablishment` (auto-importado), `categorySchema`/`categoryIdParamSchema` de `#shared/schemas/category.schema`, `toCategoryDto` (auto-importado).
- Produces: `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/:id`.

- [ ] **Step 1: `index.get.ts`**

```ts
import { createError, defineEventHandler } from 'h3'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    logServerError('admin.categories.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar as categorias.' })
  }

  return data.map(toCategoryDto)
})
```

- [ ] **Step 2: `index.post.ts`**

```ts
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { categorySchema } from '#shared/schemas/category.schema'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => categorySchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados da categoria inválidos.' })
  }

  const { data, error } = await client
    .from('categories')
    .insert({
      establishment_id: establishment.id,
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
    })
    .select('*')
    .single()

  if (error) {
    logServerError('admin.categories.create', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar a categoria.' })
  }

  return toCategoryDto(data)
})
```

- [ ] **Step 3: `[id].patch.ts`**

```ts
import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { categoryIdParamSchema, categorySchema } from '#shared/schemas/category.schema'
import type { CategoryDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<CategoryDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = categoryIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
  }

  const parsed = await readValidatedBody(event, (body) => categorySchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados da categoria inválidos.' })
  }

  const { data, error } = await client
    .from('categories')
    .update({ name: parsed.data.name, sort_order: parsed.data.sortOrder })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .maybeSingle()

  if (error) {
    logServerError('admin.categories.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar a categoria.' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  return toCategoryDto(data)
})
```

- [ ] **Step 4: `[id].delete.ts`**

```ts
import { createError, defineEventHandler, getRouterParams } from 'h3'
import { categoryIdParamSchema } from '#shared/schemas/category.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = categoryIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
  }

  const { error, count } = await client
    .from('categories')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.categories.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir a categoria.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  return { ok: true }
})
```

- [ ] **Step 5: Verificar manualmente**

Run: `pnpm dev`, faça login no admin, e no console do navegador (autenticado) rode:

```js
await $fetch('/api/admin/categories', { method: 'POST', body: { name: 'Bebidas', sortOrder: 0 } })
await $fetch('/api/admin/categories')
```

Expected: a categoria criada aparece na listagem; alterar/excluir via os mesmos métodos funciona e reflete no banco.

- [ ] **Step 6: Commit**

```bash
git add layers/admin/server/api/admin/categories
git commit -m "Add categories CRUD routes"
```

---

### Task 6: Rotas de grupos de complemento

**Files:**
- Create: `layers/admin/server/api/admin/complement-groups/index.get.ts`
- Create: `layers/admin/server/api/admin/complement-groups/index.post.ts`
- Create: `layers/admin/server/api/admin/complement-groups/[id].patch.ts`
- Create: `layers/admin/server/api/admin/complement-groups/[id].delete.ts`

**Interfaces:**
- Consumes: `complementGroupSchema`/`complementGroupIdParamSchema` de `#shared/schemas/complement-group.schema`, `toComplementGroupDto` e o tipo `ComplementGroupRowWithOptions` (auto-importado o primeiro; o tipo precisa de import explícito de `#shared/types/database-relations`).
- Produces: `GET/POST /api/admin/complement-groups`, `PATCH/DELETE /api/admin/complement-groups/:id`.

- [ ] **Step 1: `index.get.ts`**

```ts
import { createError, defineEventHandler } from 'h3'
import type { ComplementGroupRowWithOptions } from '#shared/types/database-relations'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('complement_groups')
    .select('*, complement_options(*)')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    logServerError('admin.complement-groups.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar os complementos.' })
  }

  return (data as ComplementGroupRowWithOptions[]).map(toComplementGroupDto)
})
```

- [ ] **Step 2: `index.post.ts`**

```ts
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { complementGroupSchema } from '#shared/schemas/complement-group.schema'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => complementGroupSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Dados do grupo inválidos.' })
  }

  const input = parsed.data

  const { data: group, error: groupError } = await client
    .from('complement_groups')
    .insert({
      establishment_id: establishment.id,
      name: input.name,
      is_required: input.isRequired,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  if (groupError) {
    logServerError('admin.complement-groups.create', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o grupo de complementos.' })
  }

  const { data: options, error: optionsError } = await client
    .from('complement_options')
    .insert(
      input.options.map((option, index) => ({
        group_id: group.id,
        name: option.name,
        price_delta: option.priceDelta,
        sort_order: option.sortOrder ?? index,
      })),
    )
    .select('*')

  if (optionsError) {
    logServerError('admin.complement-groups.create-options', optionsError)
    throw createError({ statusCode: 500, statusMessage: 'Grupo criado, mas não foi possível salvar as opções.' })
  }

  return toComplementGroupDto({ ...group, complement_options: options })
})
```

- [ ] **Step 3: `[id].patch.ts`**

```ts
import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { complementGroupIdParamSchema, complementGroupSchema } from '#shared/schemas/complement-group.schema'
import type { ComplementGroupDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ComplementGroupDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = complementGroupIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Grupo inválido.' })
  }

  const parsed = await readValidatedBody(event, (body) => complementGroupSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Dados do grupo inválidos.' })
  }

  const input = parsed.data

  const { data: group, error: groupError } = await client
    .from('complement_groups')
    .update({
      name: input.name,
      is_required: input.isRequired,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      sort_order: input.sortOrder,
    })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .maybeSingle()

  if (groupError) {
    logServerError('admin.complement-groups.update', groupError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o grupo de complementos.' })
  }
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Grupo não encontrado.' })
  }

  const { error: deleteError } = await client.from('complement_options').delete().eq('group_id', group.id)
  if (deleteError) {
    logServerError('admin.complement-groups.update-options-delete', deleteError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar as opções do grupo.' })
  }

  const { data: options, error: optionsError } = await client
    .from('complement_options')
    .insert(
      input.options.map((option, index) => ({
        group_id: group.id,
        name: option.name,
        price_delta: option.priceDelta,
        sort_order: option.sortOrder ?? index,
      })),
    )
    .select('*')

  if (optionsError) {
    logServerError('admin.complement-groups.update-options-insert', optionsError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar as opções do grupo.' })
  }

  return toComplementGroupDto({ ...group, complement_options: options })
})
```

- [ ] **Step 4: `[id].delete.ts`**

```ts
import { createError, defineEventHandler, getRouterParams } from 'h3'
import { complementGroupIdParamSchema } from '#shared/schemas/complement-group.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = complementGroupIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Grupo inválido.' })
  }

  const { error, count } = await client
    .from('complement_groups')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.complement-groups.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o grupo de complementos.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Grupo não encontrado.' })
  }

  return { ok: true }
})
```

- [ ] **Step 5: Verificar manualmente**

No console do navegador autenticado:

```js
await $fetch('/api/admin/complement-groups', {
  method: 'POST',
  body: { name: 'Tamanho', isRequired: true, minSelect: 1, maxSelect: 1, sortOrder: 0,
    options: [{ name: 'Pequeno', priceDelta: 0 }, { name: 'Grande', priceDelta: 5 }] },
})
await $fetch('/api/admin/complement-groups')
```

Expected: grupo criado com as duas opções aninhadas; editar substitui o conjunto de opções; excluir remove o grupo e suas opções (cascade).

- [ ] **Step 6: Commit**

```bash
git add layers/admin/server/api/admin/complement-groups
git commit -m "Add complement groups CRUD routes"
```

---

### Task 7: Rota de upload de imagem

**Files:**
- Create: `layers/admin/server/api/admin/products/upload-image.post.ts`

**Interfaces:**
- Consumes: `requireEstablishment` (auto-importado).
- Produces: `POST /api/admin/products/upload-image` recebendo multipart (`file`), retornando `{ url: string }`.

- [ ] **Step 1: Escrever a rota**

```ts
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { randomUUID } from 'node:crypto'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event): Promise<{ url: string }> => {
  const { client, establishment } = await requireEstablishment(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file')

  if (!file || !file.data.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhuma imagem enviada.' })
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo enviado não é uma imagem.' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Imagem muito grande.' })
  }

  const path = `${establishment.id}/${randomUUID()}.webp`

  const { error: uploadError } = await client.storage
    .from('product-images')
    .upload(path, file.data, { contentType: 'image/webp' })

  if (uploadError) {
    logServerError('admin.products.upload-image', uploadError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível enviar a imagem.' })
  }

  const { data } = client.storage.from('product-images').getPublicUrl(path)

  return { url: data.publicUrl }
})
```

- [ ] **Step 2: Verificar manualmente**

No console do navegador autenticado:

```js
const blob = new Blob([new Uint8Array([1,2,3])], { type: 'image/webp' })
const form = new FormData()
form.append('file', blob, 'test.webp')
await $fetch('/api/admin/products/upload-image', { method: 'POST', body: form })
```

Expected: retorna `{ url: "https://.../storage/v1/object/public/product-images/<establishment_id>/<uuid>.webp" }`; confirme no Storage do Supabase Studio que o arquivo existe nesse caminho.

- [ ] **Step 3: Commit**

```bash
git add layers/admin/server/api/admin/products/upload-image.post.ts
git commit -m "Add product image upload route"
```

---

### Task 8: Atualizar rotas de produtos (categoria, complementos, limpeza de imagem)

**Files:**
- Modify: `layers/admin/server/api/admin/products/index.get.ts`
- Modify: `layers/admin/server/api/admin/products/index.post.ts`
- Modify: `layers/admin/server/api/admin/products/[id].patch.ts`
- Modify: `layers/admin/server/api/admin/products/[id].delete.ts`

**Interfaces:**
- Consumes: `syncProductComplementGroups`, `deleteProductImageIfOwned`, `toProductDto` (todos auto-importados), `ProductRowWithComplementGroupIds` de `#shared/types/database-relations`.
- Produces: `ProductDto` com `categoryId`/`complementGroupIds` corretos em todas as respostas.

- [ ] **Step 1: `index.get.ts`**

```ts
import { createError, defineEventHandler } from 'h3'
import type { ProductRowWithComplementGroupIds } from '#shared/types/database-relations'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto[]> => {
  const { client, establishment } = await requireEstablishment(event)

  const { data, error } = await client
    .from('products')
    .select('*, product_complement_groups(group_id)')
    .eq('establishment_id', establishment.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    logServerError('admin.products.list', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar os produtos.' })
  }

  return (data as ProductRowWithComplementGroupIds[]).map((row) =>
    toProductDto(row, row.product_complement_groups.map((link) => link.group_id)),
  )
})
```

- [ ] **Step 2: `index.post.ts`**

```ts
import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { productSchema } from '#shared/schemas/product.schema'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const parsed = await readValidatedBody(event, (body) => productSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados do produto inválidos.' })
  }

  const input = parsed.data

  const { data, error } = await client
    .from('products')
    .insert({
      establishment_id: establishment.id,
      name: input.name,
      description: input.description || null,
      price: input.price,
      promo_price: input.promoPrice ?? null,
      cost: input.cost ?? null,
      category_id: input.categoryId,
      image_url: input.imageUrl || null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single()

  if (error) {
    logServerError('admin.products.create', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o produto.' })
  }

  const complementGroupIds = await syncProductComplementGroups(client, establishment.id, data.id, input.complementGroupIds)

  return toProductDto(data, complementGroupIds)
})
```

- [ ] **Step 3: `[id].patch.ts`**

```ts
import { createError, defineEventHandler, getRouterParams, readValidatedBody } from 'h3'
import { productIdParamSchema, productSchema } from '#shared/schemas/product.schema'
import type { ProductDto } from '#shared/types/domain'

export default defineEventHandler(async (event): Promise<ProductDto> => {
  const { client, establishment } = await requireEstablishment(event)

  const params = productIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
  }

  const parsed = await readValidatedBody(event, (body) => productSchema.safeParse(body))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados do produto inválidos.' })
  }

  const input = parsed.data

  const { data: existing, error: existingError } = await client
    .from('products')
    .select('image_url')
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .maybeSingle()

  if (existingError) {
    logServerError('admin.products.update.lookup', existingError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o produto.' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  const { data, error } = await client
    .from('products')
    .update({
      name: input.name,
      description: input.description || null,
      price: input.price,
      promo_price: input.promoPrice ?? null,
      cost: input.cost ?? null,
      category_id: input.categoryId,
      image_url: input.imageUrl || null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      sort_order: input.sortOrder,
    })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .select('*')
    .single()

  if (error) {
    logServerError('admin.products.update', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o produto.' })
  }

  const newImageUrl = input.imageUrl || null
  if (existing.image_url && existing.image_url !== newImageUrl) {
    await deleteProductImageIfOwned(client, existing.image_url)
  }

  const complementGroupIds = await syncProductComplementGroups(client, establishment.id, data.id, input.complementGroupIds)

  return toProductDto(data, complementGroupIds)
})
```

- [ ] **Step 4: `[id].delete.ts`**

```ts
import { createError, defineEventHandler, getRouterParams } from 'h3'
import { productIdParamSchema } from '#shared/schemas/product.schema'

export default defineEventHandler(async (event) => {
  const { client, establishment } = await requireEstablishment(event)

  const params = productIdParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
  }

  const { data: existing, error: existingError } = await client
    .from('products')
    .select('image_url')
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)
    .maybeSingle()

  if (existingError) {
    logServerError('admin.products.delete.lookup', existingError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o produto.' })
  }
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  const { error, count } = await client
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', params.data.id)
    .eq('establishment_id', establishment.id)

  if (error) {
    logServerError('admin.products.delete', error)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível excluir o produto.' })
  }
  if (!count) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
  }

  await deleteProductImageIfOwned(client, existing.image_url)

  return { ok: true }
})
```

- [ ] **Step 5: Typecheck e verificação manual**

Run: `pnpm exec nuxt typecheck` — não deve haver mais erros relacionados a `product.category`/`row.category`.

No console do navegador autenticado, crie um produto com `categoryId` e `complementGroupIds` apontando para registros criados nas Tasks 5/6, depois edite trocando a imagem (usando uma URL fake de `product-images/<establishment_id>/algo.webp` para o teste) e confirme que a imagem antiga é removida do Storage.

- [ ] **Step 6: Commit**

```bash
git add layers/admin/server/api/admin/products
git commit -m "Wire product routes to categories, complement groups, and image cleanup"
```

---

### Task 9: Atualizar rota do cardápio público

**Files:**
- Modify: `layers/menu/server/api/menu/[slug].get.ts`

**Interfaces:**
- Consumes: `toPublicMenuProductDto`/`toEstablishmentDto` (auto-importados), `ProductRowWithMenuRelations` de `#shared/types/database-relations`.
- Produces: `PublicMenuDto` com `category`/`complementGroups` populados, produtos ordenados por categoria e depois por produto. `promoPrice`/`isFeatured` e o banner (`establishment.coverImageUrl`) continuam vindo normalmente — nenhum deles depende de mudança nesta rota, só precisam sobreviver à reescrita.

- [ ] **Step 1: Reescrever a rota**

```ts
import { createError, defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import type { ProductRowWithMenuRelations } from '#shared/types/database-relations'
import type { PublicMenuDto } from '#shared/types/domain'

const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(80),
})

export default defineEventHandler(async (event): Promise<PublicMenuDto> => {
  const params = slugParamSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Cardápio inválido.' })
  }

  const client = await serverSupabaseClient<Database>(event)

  const { data: establishment, error: establishmentError } = await client
    .from('establishments')
    .select('*')
    .eq('slug', params.data.slug)
    .maybeSingle()

  if (establishmentError) {
    logServerError('menu.establishment.lookup', establishmentError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }
  if (!establishment) {
    throw createError({ statusCode: 404, statusMessage: 'Cardápio não encontrado.' })
  }

  const { data: products, error: productsError } = await client
    .from('products')
    .select(
      `*,
      categories (id, name, sort_order),
      product_complement_groups (
        complement_groups (
          id, name, is_required,
          complement_options (id, name, price_delta, is_active, sort_order)
        )
      )`,
    )
    .eq('establishment_id', establishment.id)
    .eq('is_active', true)

  if (productsError) {
    logServerError('menu.products.list', productsError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível carregar o cardápio.' })
  }

  const sorted = (products as unknown as ProductRowWithMenuRelations[]).slice().sort((a, b) => {
    const categoryOrder =
      (a.categories?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.categories?.sort_order ?? Number.MAX_SAFE_INTEGER)
    if (categoryOrder !== 0) return categoryOrder
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })

  return {
    establishment: toEstablishmentDto(establishment),
    products: sorted.map(toPublicMenuProductDto),
  }
})
```

- [ ] **Step 2: Verificar manualmente**

Com um produto ativo, com categoria e grupo de complemento vinculados (das Tasks 5/6/8), acesse `/api/menu/<slug>` diretamente no navegador.

Expected: JSON com `products[].category = { id, name }` e `products[].complementGroups` contendo o grupo com suas opções.

- [ ] **Step 3: Commit**

```bash
git add layers/menu/server/api/menu/[slug].get.ts
git commit -m "Include category and complement groups in the public menu response"
```

---

### Task 10: Primitivos de UI — Tabs e Checkbox

**Files:**
- Create: `layers/base/app/components/ui/tabs/TabsList.vue`
- Create: `layers/base/app/components/ui/tabs/TabsTrigger.vue`
- Create: `layers/base/app/components/ui/tabs/TabsContent.vue`
- Create: `layers/base/app/components/ui/tabs/index.ts`
- Create: `layers/base/app/components/ui/checkbox/Checkbox.vue`
- Create: `layers/base/app/components/ui/checkbox/index.ts`
- Modify: `layers/base/app/plugins/register-primitives.ts`

**Interfaces:**
- Produces: `<Tabs>` (registrado globalmente pelo plugin, igual `<Dialog>`/`<AlertDialog>` — sem import explícito), `<TabsList>`/`<TabsTrigger>`/`<TabsContent>`/`<Checkbox>` (auto-importados por nome de arquivo, mesmo padrão de `Switch.vue`).

Um plugin `register-primitives.ts` já existe neste repo (de um fix recente) registrando `Dialog`/`DialogTrigger`/`DialogClose`/`AlertDialog`/`AlertDialogTrigger` como componentes globais via `app.component()`, porque esses primitivos são re-exports de `reka-ui` sem arquivo `.vue` próprio — o auto-import de componentes do Nuxt só escaneia arquivos `.vue`, então usá-los sem import explícito renderiza um elemento inerte em produção. `Tabs` (aliás de `TabsRoot`, também sem arquivo próprio) tem exatamente o mesmo problema — por isso este plugin ganha uma linha extra em vez de a Task 15 importar `Tabs` manualmente.

- [ ] **Step 1: `TabsList.vue`**

```vue
<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsList, type TabsListProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsList
    v-bind="forwarded"
    :class="cn('inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', props.class)"
  >
    <slot />
  </TabsList>
</template>
```

- [ ] **Step 2: `TabsTrigger.vue`**

```vue
<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
```

- [ ] **Step 3: `TabsContent.vue`**

```vue
<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { TabsContent, type TabsContentProps, useForwardProps } from 'reka-ui'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <TabsContent v-bind="forwarded" :class="cn('mt-4 focus-visible:outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
```

- [ ] **Step 4: `tabs/index.ts`**

```ts
export { TabsRoot as Tabs } from 'reka-ui'
export { default as TabsList } from './TabsList.vue'
export { default as TabsTrigger } from './TabsTrigger.vue'
export { default as TabsContent } from './TabsContent.vue'
```

- [ ] **Step 5: `checkbox/Checkbox.vue`**

```vue
<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { CheckboxIndicator, CheckboxRoot, type CheckboxRootEmits, type CheckboxRootProps, useForwardPropsEmits } from 'reka-ui'
import { Check } from '@lucide/vue'
import { cn } from '#layers/base/app/lib/utils'

const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<CheckboxRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Check class="size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
```

- [ ] **Step 6: `checkbox/index.ts`**

```ts
export { default as Checkbox } from './Checkbox.vue'
```

- [ ] **Step 7: Registrar `Tabs` no plugin `register-primitives.ts`**

Adicione `TabsRoot` à lista de imports de `reka-ui` e registre-o como `'Tabs'`, ao lado das linhas já existentes para `Dialog`/`AlertDialog` — não remova nem reordene as linhas atuais.

```ts
import { AlertDialogRoot, AlertDialogTrigger, DialogClose, DialogRoot, DialogTrigger, TabsRoot } from 'reka-ui'

/**
 * Nuxt's component auto-import only scans .vue files, so re-exported
 * primitives (Dialog/AlertDialog root + trigger/close, aliased from
 * reka-ui in dialog/index.ts and alert-dialog/index.ts) never become
 * global components on their own - templates using <Dialog> etc. without
 * an explicit import silently render an inert custom element. Registering
 * them here makes them resolvable everywhere, matching how every other
 * ui/ component already behaves.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('Dialog', DialogRoot)
  nuxtApp.vueApp.component('DialogTrigger', DialogTrigger)
  nuxtApp.vueApp.component('DialogClose', DialogClose)
  nuxtApp.vueApp.component('AlertDialog', AlertDialogRoot)
  nuxtApp.vueApp.component('AlertDialogTrigger', AlertDialogTrigger)
  nuxtApp.vueApp.component('Tabs', TabsRoot)
})
```

- [ ] **Step 8: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: sem erros novos nos arquivos criados ou modificados.

- [ ] **Step 9: Commit**

```bash
git add layers/base/app/components/ui/tabs layers/base/app/components/ui/checkbox layers/base/app/plugins/register-primitives.ts
git commit -m "Add Tabs and Checkbox UI primitives"
```

---

### Task 11: Admin de categorias — store, dialogs e aba

**Files:**
- Create: `layers/admin/app/stores/categories.ts`
- Create: `layers/admin/app/components/admin/CategoryFormDialog.vue`
- Create: `layers/admin/app/components/admin/DeleteCategoryDialog.vue`
- Create: `layers/admin/app/components/admin/CategoriesTab.vue`

**Interfaces:**
- Consumes: `CategoryDto`/`categorySchema`/`CategoryInput`, `useProductsStore` (já existente, para o alerta de exclusão).
- Produces: `useCategoriesStore()` com `{ items, loaded, loading, fetchAll, create, update, remove }`; componente `<CategoriesTab>` (auto-importado, plano na Task 15).

- [ ] **Step 1: `stores/categories.ts`**

```ts
import { defineStore } from 'pinia'
import type { CategoryDto } from '#shared/types/domain'
import type { CategoryInput } from '#shared/schemas/category.schema'

export const useCategoriesStore = defineStore('admin-categories', {
  state: () => ({
    items: [] as CategoryDto[],
    loaded: false,
    loading: false,
  }),

  actions: {
    async fetchAll(fetcher: typeof $fetch = $fetch) {
      this.loading = true
      try {
        this.items = await fetcher<CategoryDto[]>('/api/admin/categories')
        this.loaded = true
      }
      finally {
        this.loading = false
      }
    },

    async create(input: CategoryInput) {
      const category = await $fetch<CategoryDto>('/api/admin/categories', {
        method: 'POST',
        body: input,
      })
      this.items.push(category)
      return category
    },

    async update(id: string, input: CategoryInput) {
      const category = await $fetch<CategoryDto>(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const index = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = category
      return category
    },

    async remove(id: string) {
      await $fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
```

- [ ] **Step 2: `CategoryFormDialog.vue`**

`Dialog`/`DialogContent`/etc. não são importados — `Dialog` é registrado globalmente pelo plugin `register-primitives.ts` (ver Task 10), e `DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` são auto-importados por serem arquivos `.vue` próprios.

```vue
<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import { categorySchema } from "#shared/schemas/category.schema";
import type { CategoryDto } from "#shared/types/domain";

const props = defineProps<{
  category?: CategoryDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useCategoriesStore();

const form = reactive({
  name: "",
  sortOrder: 0,
});

const submitting = ref(false);
const errorMessage = ref("");

function resetForm() {
  form.name = props.category?.name ?? "";
  form.sortOrder = props.category?.sortOrder ?? store.items.length;
  errorMessage.value = "";
}

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const isEditing = computed(() => Boolean(props.category));

async function onSubmit() {
  errorMessage.value = "";
  const parsed = categorySchema.safeParse(form);
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? "Verifique os campos.";
    return;
  }

  submitting.value = true;
  try {
    if (props.category) {
      await store.update(props.category.id, parsed.data);
      toast.success("Categoria atualizada.");
    } else {
      await store.create(parsed.data);
      toast.success("Categoria criada.");
    }
    open.value = false;
  } catch (error) {
    errorMessage.value = getErrorMessage(error) ?? "Não foi possível salvar a categoria.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Editar categoria" : "Nova categoria" }}</DialogTitle>
        <DialogDescription>Categorias organizam os produtos no seu cardápio.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="category-name">Nome</Label>
          <Input id="category-name" v-model="form.name" required placeholder="Ex: Lanches" />
        </div>

        <div class="space-y-1.5">
          <Label for="category-sort-order">Ordem de exibição</Label>
          <Input id="category-sort-order" v-model="form.sortOrder" type="number" min="0" step="1" />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">{{ submitting ? "Salvando..." : "Salvar" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 3: `DeleteCategoryDialog.vue`**

`AlertDialog` também é global via o plugin — sem import explícito, mesmo padrão de `DeleteProductDialog.vue`.

```vue
<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import type { CategoryDto } from "#shared/types/domain";

const props = defineProps<{
  category: CategoryDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useCategoriesStore();
const productsStore = useProductsStore();
const removing = ref(false);

const affectedProductsCount = computed(() => {
  if (!props.category) return 0;
  return productsStore.items.filter((product) => product.categoryId === props.category?.id).length;
});

async function onConfirm() {
  if (!props.category) return;
  removing.value = true;
  try {
    await store.remove(props.category.id);
    toast.success("Categoria excluída.");
    open.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível excluir a categoria.");
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
        <AlertDialogDescription>
          Tem certeza que deseja excluir <strong>{{ category?.name }}</strong>?
          <template v-if="affectedProductsCount > 0">
            {{ affectedProductsCount }} {{ affectedProductsCount === 1 ? "produto ficará" : "produtos ficarão" }} sem categoria.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">Cancelar</AlertDialogCancel>
        <AlertDialogAction :disabled="removing" @click.prevent="onConfirm">
          {{ removing ? "Excluindo..." : "Excluir" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

- [ ] **Step 4: `CategoriesTab.vue`**

```vue
<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import type { CategoryDto } from '#shared/types/domain'

const store = useCategoriesStore()

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeCategory = ref<CategoryDto | null>(null)

function openCreate() {
  activeCategory.value = null
  formOpen.value = true
}

function openEdit(category: CategoryDto) {
  activeCategory.value = category
  formOpen.value = true
}

function openDelete(category: CategoryDto) {
  activeCategory.value = category
  deleteOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">Organize os produtos do seu cardápio em categorias.</p>
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Nova categoria
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhuma categoria cadastrada ainda</p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Nova categoria
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="category in store.items" :key="category.id">
              <TableCell class="font-medium">{{ category.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ category.sortOrder }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(category)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(category)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <CategoryFormDialog v-model="formOpen" :category="activeCategory" />
    <DeleteCategoryDialog v-model="deleteOpen" :category="activeCategory" />
  </div>
</template>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: sem erros nestes quatro arquivos (o componente `CategoriesTab` só será exibido em uma página a partir da Task 15, então não há verificação visual ainda).

- [ ] **Step 6: Commit**

```bash
git add layers/admin/app/stores/categories.ts layers/admin/app/components/admin/CategoryFormDialog.vue layers/admin/app/components/admin/DeleteCategoryDialog.vue layers/admin/app/components/admin/CategoriesTab.vue
git commit -m "Add categories admin store, dialogs, and tab"
```

---

### Task 12: Admin de complementos — store, dialogs e aba

**Files:**
- Create: `layers/admin/app/stores/complement-groups.ts`
- Create: `layers/admin/app/components/admin/ComplementGroupFormDialog.vue`
- Create: `layers/admin/app/components/admin/DeleteComplementGroupDialog.vue`
- Create: `layers/admin/app/components/admin/ComplementGroupsTab.vue`

**Interfaces:**
- Consumes: `ComplementGroupDto`/`complementGroupSchema`/`ComplementGroupInput`, `useProductsStore`.
- Produces: `useComplementGroupsStore()` com `{ items, loaded, loading, fetchAll, create, update, remove }`.

- [ ] **Step 1: `stores/complement-groups.ts`**

```ts
import { defineStore } from 'pinia'
import type { ComplementGroupDto } from '#shared/types/domain'
import type { ComplementGroupInput } from '#shared/schemas/complement-group.schema'

export const useComplementGroupsStore = defineStore('admin-complement-groups', {
  state: () => ({
    items: [] as ComplementGroupDto[],
    loaded: false,
    loading: false,
  }),

  actions: {
    async fetchAll(fetcher: typeof $fetch = $fetch) {
      this.loading = true
      try {
        this.items = await fetcher<ComplementGroupDto[]>('/api/admin/complement-groups')
        this.loaded = true
      }
      finally {
        this.loading = false
      }
    },

    async create(input: ComplementGroupInput) {
      const group = await $fetch<ComplementGroupDto>('/api/admin/complement-groups', {
        method: 'POST',
        body: input,
      })
      this.items.push(group)
      return group
    },

    async update(id: string, input: ComplementGroupInput) {
      const group = await $fetch<ComplementGroupDto>(`/api/admin/complement-groups/${id}`, {
        method: 'PATCH',
        body: input,
      })
      const index = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = group
      return group
    },

    async remove(id: string) {
      await $fetch(`/api/admin/complement-groups/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
```

- [ ] **Step 2: `ComplementGroupFormDialog.vue`**

`Dialog` é global via o plugin (Task 10) — sem import explícito.

```vue
<script setup lang="ts">
import { Plus, Trash2 } from "@lucide/vue";
import { toast } from "#layers/base/app/components/ui/sonner";
import { complementGroupSchema } from "#shared/schemas/complement-group.schema";
import type { ComplementGroupDto } from "#shared/types/domain";

const props = defineProps<{
  group?: ComplementGroupDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useComplementGroupsStore();

const form = reactive({
  name: "",
  isRequired: false,
  minSelect: 0 as number | string,
  maxSelect: "" as number | string,
  sortOrder: 0,
  options: [] as { name: string; priceDelta: number | string }[],
});

const submitting = ref(false);
const errorMessage = ref("");

function resetForm() {
  const group = props.group;
  form.name = group?.name ?? "";
  form.isRequired = group?.isRequired ?? false;
  form.minSelect = group?.minSelect ?? 0;
  form.maxSelect = group?.maxSelect ?? "";
  form.sortOrder = group?.sortOrder ?? store.items.length;
  form.options = group?.options.length
    ? group.options.map((option) => ({ name: option.name, priceDelta: option.priceDelta }))
    : [{ name: "", priceDelta: 0 }];
  errorMessage.value = "";
}

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const isEditing = computed(() => Boolean(props.group));

function addOption() {
  form.options.push({ name: "", priceDelta: 0 });
}

function removeOption(index: number) {
  form.options.splice(index, 1);
}

async function onSubmit() {
  errorMessage.value = "";
  const parsed = complementGroupSchema.safeParse({
    ...form,
    maxSelect: form.maxSelect === "" ? null : form.maxSelect,
    options: form.options
      .filter((option) => option.name.trim() !== "")
      .map((option, index) => ({ ...option, sortOrder: index })),
  });
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? "Verifique os campos do formulário.";
    return;
  }

  submitting.value = true;
  try {
    if (props.group) {
      await store.update(props.group.id, parsed.data);
      toast.success("Grupo de complementos atualizado.");
    } else {
      await store.create(parsed.data);
      toast.success("Grupo de complementos criado.");
    }
    open.value = false;
  } catch (error) {
    errorMessage.value = getErrorMessage(error) ?? "Não foi possível salvar o grupo de complementos.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Editar grupo de complementos" : "Novo grupo de complementos" }}</DialogTitle>
        <DialogDescription>
          Grupos podem ser reaproveitados em vários produtos, como "Escolha o tamanho" ou "Adicionais".
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="group-name">Nome</Label>
          <Input id="group-name" v-model="form.name" required placeholder="Ex: Escolha o tamanho" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="group-min">Seleções mínimas</Label>
            <Input id="group-min" v-model="form.minSelect" type="number" min="0" step="1" />
          </div>
          <div class="space-y-1.5">
            <Label for="group-max">Seleções máximas (opcional)</Label>
            <Input id="group-max" v-model="form.maxSelect" type="number" min="0" step="1" />
          </div>
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Obrigatório</p>
            <p class="text-xs text-muted-foreground">O cliente precisa escolher pelo menos uma opção deste grupo.</p>
          </div>
          <Switch v-model="form.isRequired" />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Opções</Label>
            <Button type="button" variant="ghost" size="sm" class="gap-1" @click="addOption">
              <Plus class="size-4" />
              Adicionar opção
            </Button>
          </div>

          <div v-for="(option, index) in form.options" :key="index" class="flex gap-2">
            <Input v-model="option.name" placeholder="Ex: Grande" class="flex-1" />
            <Input v-model="option.priceDelta" type="number" min="0" step="0.01" placeholder="R$ 0,00" class="w-28" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover opção"
              :disabled="form.options.length <= 1"
              @click="removeOption(index)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">{{ submitting ? "Salvando..." : "Salvar" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 3: `DeleteComplementGroupDialog.vue`**

`AlertDialog` é global via o plugin — sem import explícito.

```vue
<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import type { ComplementGroupDto } from "#shared/types/domain";

const props = defineProps<{
  group: ComplementGroupDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useComplementGroupsStore();
const productsStore = useProductsStore();
const removing = ref(false);

const affectedProductsCount = computed(() => {
  if (!props.group) return 0;
  return productsStore.items.filter((product) => product.complementGroupIds.includes(props.group!.id)).length;
});

async function onConfirm() {
  if (!props.group) return;
  removing.value = true;
  try {
    await store.remove(props.group.id);
    toast.success("Grupo de complementos excluído.");
    open.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível excluir o grupo de complementos.");
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir grupo de complementos?</AlertDialogTitle>
        <AlertDialogDescription>
          Tem certeza que deseja excluir <strong>{{ group?.name }}</strong>?
          <template v-if="affectedProductsCount > 0">
            {{ affectedProductsCount }} {{ affectedProductsCount === 1 ? "produto perderá" : "produtos perderão" }} este complemento.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">Cancelar</AlertDialogCancel>
        <AlertDialogAction :disabled="removing" @click.prevent="onConfirm">
          {{ removing ? "Excluindo..." : "Excluir" }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

- [ ] **Step 4: `ComplementGroupsTab.vue`**

```vue
<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import type { ComplementGroupDto } from '#shared/types/domain'

const store = useComplementGroupsStore()

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeGroup = ref<ComplementGroupDto | null>(null)

function openCreate() {
  activeGroup.value = null
  formOpen.value = true
}

function openEdit(group: ComplementGroupDto) {
  activeGroup.value = group
  formOpen.value = true
}

function openDelete(group: ComplementGroupDto) {
  activeGroup.value = group
  deleteOpen.value = true
}

function selectSummary(group: ComplementGroupDto) {
  if (group.maxSelect === null) return `mín. ${group.minSelect}`
  return `${group.minSelect}–${group.maxSelect}`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted-foreground">Grupos podem ser reaproveitados em vários produtos.</p>
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Novo grupo
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhum grupo de complementos cadastrado ainda</p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Novo grupo
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Obrigatório</TableHead>
              <TableHead>Seleções</TableHead>
              <TableHead>Opções</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="group in store.items" :key="group.id">
              <TableCell class="font-medium">{{ group.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ group.isRequired ? "Sim" : "Não" }}</TableCell>
              <TableCell class="text-muted-foreground">{{ selectSummary(group) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ group.options.length }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(group)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(group)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ComplementGroupFormDialog v-model="formOpen" :group="activeGroup" />
    <DeleteComplementGroupDialog v-model="deleteOpen" :group="activeGroup" />
  </div>
</template>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: sem erros nestes quatro arquivos.

- [ ] **Step 6: Commit**

```bash
git add layers/admin/app/stores/complement-groups.ts layers/admin/app/components/admin/ComplementGroupFormDialog.vue layers/admin/app/components/admin/DeleteComplementGroupDialog.vue layers/admin/app/components/admin/ComplementGroupsTab.vue
git commit -m "Add complement groups admin store, dialogs, and tab"
```

---

### Task 13: Upload de imagem do produto (otimização client-side)

**Files:**
- Create: `layers/admin/app/composables/useImageOptimization.ts`
- Create: `layers/admin/app/components/admin/ProductImageUpload.vue`

**Interfaces:**
- Produces: `optimizeImageToWebp(file: File): Promise<{ blob: Blob; originalBytes: number; optimizedBytes: number }>`, `formatBytes(bytes: number): string` (auto-importados); componente `<ProductImageUpload>` com `defineModel<string>()` para a URL da imagem.

- [ ] **Step 1: `useImageOptimization.ts`**

```ts
const MAX_DIMENSION = 1000
const TARGET_MAX_BYTES = 300_000
const QUALITY_STEPS = [0.82, 0.7, 0.6]

export interface OptimizedImage {
  blob: Blob
  originalBytes: number
  optimizedBytes: number
}

export async function optimizeImageToWebp(file: File): Promise<OptimizedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Este navegador não suporta o processamento de imagens necessário.')

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob: Blob | null = null
  for (const quality of QUALITY_STEPS) {
    blob = await canvasToWebpBlob(canvas, quality)
    if (blob.size <= TARGET_MAX_BYTES) break
  }
  if (!blob) throw new Error('Não foi possível otimizar a imagem.')

  return { blob, originalBytes: file.size, optimizedBytes: blob.size }
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem.'))),
      'image/webp',
      quality,
    )
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}
```

- [ ] **Step 2: `ProductImageUpload.vue`**

```vue
<script setup lang="ts">
import { ImagePlus, Loader2, X } from "@lucide/vue";
import { toast } from "#layers/base/app/components/ui/sonner";

const modelValue = defineModel<string>({ default: "" });

const fileInput = ref<HTMLInputElement | null>(null);
const localPreviewUrl = ref("");
const uploading = ref(false);
const sizeSummary = ref("");

const previewUrl = computed(() => localPreviewUrl.value || modelValue.value);

function openFilePicker() {
  fileInput.value?.click();
}

function clearImage() {
  modelValue.value = "";
  sizeSummary.value = "";
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value);
    localPreviewUrl.value = "";
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    toast.error("Selecione um arquivo de imagem.");
    return;
  }

  uploading.value = true;
  try {
    const { blob, originalBytes, optimizedBytes } = await optimizeImageToWebp(file);

    if (localPreviewUrl.value) URL.revokeObjectURL(localPreviewUrl.value);
    localPreviewUrl.value = URL.createObjectURL(blob);
    sizeSummary.value = `${formatBytes(originalBytes)} → ${formatBytes(optimizedBytes)}`;

    const formData = new FormData();
    formData.append("file", blob, "image.webp");

    const { url } = await $fetch<{ url: string }>("/api/admin/products/upload-image", {
      method: "POST",
      body: formData,
    });

    modelValue.value = url;
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível enviar a imagem.");
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label>Foto do produto</Label>
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-muted/40 transition-colors hover:bg-muted disabled:pointer-events-none"
        :disabled="uploading"
        @click="openFilePicker"
      >
        <img v-if="previewUrl" :src="previewUrl" alt="Pré-visualização do produto" class="size-full object-cover">
        <ImagePlus v-else class="size-6 text-muted-foreground" />
        <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 class="size-5 animate-spin text-muted-foreground" />
        </div>
      </button>

      <div class="space-y-1 text-sm">
        <Button type="button" variant="outline" size="sm" :disabled="uploading" @click="openFilePicker">
          {{ previewUrl ? "Trocar foto" : "Selecionar foto" }}
        </Button>
        <Button
          v-if="previewUrl"
          type="button"
          variant="ghost"
          size="sm"
          class="gap-1 text-muted-foreground"
          :disabled="uploading"
          @click="clearImage"
        >
          <X class="size-3.5" />
          Remover
        </Button>
        <p class="text-xs text-muted-foreground">
          Fotos aumentam a conversão do cardápio em até 40%. A imagem é otimizada automaticamente.
        </p>
        <p v-if="sizeSummary" class="text-xs text-muted-foreground">{{ sizeSummary }}</p>
      </div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected">
  </div>
</template>
```

- [ ] **Step 3: Verificar manualmente**

Este componente ainda não está montado em nenhuma página até a Task 14. Confirme só o typecheck agora.

Run: `pnpm exec nuxt typecheck`
Expected: sem erros nos dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add layers/admin/app/composables/useImageOptimization.ts layers/admin/app/components/admin/ProductImageUpload.vue
git commit -m "Add client-side image optimization and upload component"
```

---

### Task 14: Reescrever ProductFormDialog

**Files:**
- Modify: `layers/admin/app/components/admin/ProductFormDialog.vue`

**Interfaces:**
- Consumes: `ProductImageUpload` (Task 13), `useCategoriesStore`/`useComplementGroupsStore` (Tasks 11/12), `Checkbox` (Task 10), `productSchema` (categoryId/complementGroupIds da Task 3).
- Produces: dialog completo de produto com upload de imagem, categoria com criação inline, e checkboxes de complementos.

- [ ] **Step 1: Reescrever o arquivo**

Preserva `promoPrice` e `isFeatured` (campos "Preço promocional" e "Destacar no cardápio" já existentes, de um redesign recente) — soma upload de imagem, categoria com criação inline e complementos. `Dialog` é global via o plugin `register-primitives.ts` (Task 10) — sem import explícito.

```vue
<script setup lang="ts">
import { toast } from "#layers/base/app/components/ui/sonner";
import { productSchema } from "#shared/schemas/product.schema";
import type { ProductDto } from "#shared/types/domain";

const props = defineProps<{
  product?: ProductDto | null;
}>();

const open = defineModel<boolean>({ default: false });

const store = useProductsStore();
const categoriesStore = useCategoriesStore();
const complementGroupsStore = useComplementGroupsStore();

const form = reactive({
  name: "",
  description: "",
  price: "" as number | string,
  promoPrice: "" as number | string,
  cost: "" as number | string,
  categoryId: null as string | null,
  imageUrl: "",
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  complementGroupIds: [] as string[],
});

const submitting = ref(false);
const errorMessage = ref("");
const creatingCategory = ref(false);
const newCategoryName = ref("");

function resetForm() {
  const product = props.product;
  form.name = product?.name ?? "";
  form.description = product?.description ?? "";
  form.price = product?.price ?? "";
  form.promoPrice = product?.promoPrice ?? "";
  form.cost = product?.cost ?? "";
  form.categoryId = product?.categoryId ?? null;
  form.imageUrl = product?.imageUrl ?? "";
  form.isActive = product?.isActive ?? true;
  form.isFeatured = product?.isFeatured ?? false;
  form.sortOrder = product?.sortOrder ?? 0;
  form.complementGroupIds = product?.complementGroupIds ?? [];
  errorMessage.value = "";
  creatingCategory.value = false;
  newCategoryName.value = "";
}

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const isEditing = computed(() => Boolean(props.product));

function toggleComplementGroup(groupId: string, checked: boolean) {
  if (checked) {
    if (!form.complementGroupIds.includes(groupId)) form.complementGroupIds.push(groupId);
  } else {
    form.complementGroupIds = form.complementGroupIds.filter((id) => id !== groupId);
  }
}

async function onCreateCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;
  try {
    const category = await categoriesStore.create({ name, sortOrder: categoriesStore.items.length });
    form.categoryId = category.id;
    creatingCategory.value = false;
    newCategoryName.value = "";
  } catch (error) {
    toast.error(getErrorMessage(error) ?? "Não foi possível criar a categoria.");
  }
}

async function onSubmit() {
  errorMessage.value = "";
  const parsed = productSchema.safeParse({
    ...form,
    cost: form.cost === "" ? null : form.cost,
    promoPrice: form.promoPrice === "" ? null : form.promoPrice,
  });
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? "Verifique os campos do formulário.";
    return;
  }

  submitting.value = true;
  try {
    if (props.product) {
      await store.update(props.product.id, parsed.data);
      toast.success("Produto atualizado.");
    } else {
      await store.create(parsed.data);
      toast.success("Produto criado.");
    }
    open.value = false;
  } catch (error) {
    errorMessage.value = getErrorMessage(error) ?? "Não foi possível salvar o produto.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ isEditing ? "Editar produto" : "Novo produto" }}</DialogTitle>
        <DialogDescription>Esses dados aparecem no seu cardápio digital.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <ProductImageUpload v-model="form.imageUrl" />

        <div class="space-y-1.5">
          <Label for="product-name">Nome</Label>
          <Input id="product-name" v-model="form.name" required placeholder="Ex: X-Burger" />
        </div>

        <div class="space-y-1.5">
          <Label for="product-description">Descrição</Label>
          <Textarea id="product-description" v-model="form.description" placeholder="Ingredientes, detalhes..." />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="product-price">Preço de venda (R$)</Label>
            <Input id="product-price" v-model="form.price" type="number" min="0" step="0.01" required />
          </div>
          <div class="space-y-1.5">
            <Label for="product-cost">Custo (R$, opcional)</Label>
            <Input id="product-cost" v-model="form.cost" type="number" min="0" step="0.01" />
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="product-promo-price">Preço promocional (R$, opcional)</Label>
          <Input id="product-promo-price" v-model="form.promoPrice" type="number" min="0" step="0.01" placeholder="Deixe em branco para não usar" />
          <p class="text-xs text-muted-foreground">Aparece riscado no preço normal, como uma oferta.</p>
        </div>

        <div class="space-y-1.5">
          <Label for="product-category">Categoria</Label>
          <select
            id="product-category"
            v-model="form.categoryId"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          >
            <option :value="null">Sem categoria</option>
            <option v-for="category in categoriesStore.items" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>

          <Button v-if="!creatingCategory" type="button" variant="link" class="h-auto p-0 text-xs" @click="creatingCategory = true">
            + Nova categoria
          </Button>
          <div v-else class="flex gap-2">
            <Input v-model="newCategoryName" placeholder="Nome da categoria" class="flex-1" />
            <Button type="button" size="sm" @click="onCreateCategory">Criar</Button>
            <Button type="button" size="sm" variant="ghost" @click="creatingCategory = false">Cancelar</Button>
          </div>
        </div>

        <div v-if="complementGroupsStore.items.length > 0" class="space-y-1.5">
          <Label>Complementos</Label>
          <div class="space-y-2 rounded-md border p-3">
            <div v-for="group in complementGroupsStore.items" :key="group.id" class="flex items-center gap-2">
              <Checkbox
                :model-value="form.complementGroupIds.includes(group.id)"
                @update:model-value="(checked) => toggleComplementGroup(group.id, checked === true)"
              />
              <span class="text-sm">{{ group.name }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Disponível no cardápio</p>
            <p class="text-xs text-muted-foreground">Produtos indisponíveis ficam ocultos para os clientes.</p>
          </div>
          <Switch v-model="form.isActive" />
        </div>

        <div class="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p class="text-sm font-medium">Destacar no cardápio</p>
            <p class="text-xs text-muted-foreground">Aparece na vitrine de destaques, no topo do cardápio.</p>
          </div>
          <Switch v-model="form.isFeatured" />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="submit" :disabled="submitting">{{ submitting ? "Salvando..." : "Salvar" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec nuxt typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add layers/admin/app/components/admin/ProductFormDialog.vue
git commit -m "Rewrite ProductFormDialog with image upload, category select, and complement groups"
```

---

### Task 15: Página Produtos em abas

**Files:**
- Create: `layers/admin/app/components/admin/ProductsTab.vue`
- Modify: `layers/admin/app/pages/admin/produtos/index.vue`

**Interfaces:**
- Consumes: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (Task 10), `CategoriesTab` (Task 11), `ComplementGroupsTab` (Task 12), `ProductFormDialog`/`DeleteProductDialog` (Task 14 e já existente).
- Produces: `/admin/produtos` com três abas.

- [ ] **Step 1: Criar `ProductsTab.vue`**

```vue
<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import type { ProductDto } from '#shared/types/domain'

const store = useProductsStore()
const categoriesStore = useCategoriesStore()

const formOpen = ref(false)
const deleteOpen = ref(false)
const activeProduct = ref<ProductDto | null>(null)

function openCreate() {
  activeProduct.value = null
  formOpen.value = true
}

function openEdit(product: ProductDto) {
  activeProduct.value = product
  formOpen.value = true
}

function openDelete(product: ProductDto) {
  activeProduct.value = product
  deleteOpen.value = true
}

function categoryName(product: ProductDto) {
  if (!product.categoryId) return '—'
  return categoriesStore.items.find((category) => category.id === product.categoryId)?.name ?? '—'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <Button class="gap-2" @click="openCreate">
        <Plus class="size-4" />
        Novo produto
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <div v-if="store.loading && !store.loaded" class="space-y-2 p-6">
          <div class="h-10 animate-pulse rounded-md bg-muted" />
          <div class="h-10 animate-pulse rounded-md bg-muted" />
          <div class="h-10 animate-pulse rounded-md bg-muted" />
        </div>

        <div v-else-if="store.items.length === 0" class="flex flex-col items-center gap-3 p-12 text-center">
          <p class="text-sm font-medium">Nenhum produto cadastrado ainda</p>
          <p class="max-w-sm text-sm text-muted-foreground">Adicione o primeiro item do seu cardápio para começar.</p>
          <Button class="gap-2" @click="openCreate">
            <Plus class="size-4" />
            Novo produto
          </Button>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="product in store.items" :key="product.id">
              <TableCell>
                <div class="flex items-center gap-2">
                  <p class="font-medium">{{ product.name }}</p>
                  <Badge v-if="product.isFeatured" variant="outline">Destaque</Badge>
                </div>
                <p v-if="product.description" class="line-clamp-1 text-xs text-muted-foreground">{{ product.description }}</p>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ categoryName(product) }}</TableCell>
              <TableCell>
                <template v-if="product.promoPrice">
                  <span class="text-muted-foreground line-through">{{ formatCurrency(product.price) }}</span>
                  <span class="ml-1 font-medium text-primary">{{ formatCurrency(product.promoPrice) }}</span>
                </template>
                <template v-else>
                  {{ formatCurrency(product.price) }}
                </template>
              </TableCell>
              <TableCell>
                <Badge :variant="product.isActive ? 'success' : 'secondary'">
                  {{ product.isActive ? 'Ativo' : 'Inativo' }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" @click="openEdit(product)">
                    <Pencil class="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" @click="openDelete(product)">
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ProductFormDialog v-model="formOpen" :product="activeProduct" />
    <DeleteProductDialog v-model="deleteOpen" :product="activeProduct" />
  </div>
</template>
```

- [ ] **Step 2: Reescrever `produtos/index.vue`**

`Tabs` é global via o plugin (Task 10) — só `TabsList`/`TabsContent`/`TabsTrigger` (arquivos `.vue` próprios) precisam de import.

```vue
<script setup lang="ts">
import { QrCode } from '@lucide/vue'
import { TabsContent, TabsList, TabsTrigger } from '#layers/base/app/components/ui/tabs'

definePageMeta({
  middleware: ['auth', 'has-establishment'],
  layout: 'admin',
})

const auth = useAuthStore()
const productsStore = useProductsStore()
const categoriesStore = useCategoriesStore()
const complementGroupsStore = useComplementGroupsStore()

const requestFetch = useRequestFetch() as typeof $fetch
await Promise.all([
  useAsyncData('admin-products', () => productsStore.fetchAll(requestFetch)),
  useAsyncData('admin-categories', () => categoriesStore.fetchAll(requestFetch)),
  useAsyncData('admin-complement-groups', () => complementGroupsStore.fetchAll(requestFetch)),
])

const menuUrl = computed(() => {
  const slug = auth.user?.establishment?.slug
  return slug ? `/cardapio/${slug}` : null
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p class="text-sm text-muted-foreground">Gerencie o que aparece no seu cardápio digital.</p>
      </div>
      <NuxtLink
        v-if="menuUrl"
        :to="menuUrl"
        target="_blank"
        class="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <QrCode class="size-4" />
        Ver cardápio
      </NuxtLink>
    </div>

    <Tabs default-value="produtos">
      <TabsList>
        <TabsTrigger value="produtos">Produtos</TabsTrigger>
        <TabsTrigger value="categorias">Categorias</TabsTrigger>
        <TabsTrigger value="complementos">Complementos</TabsTrigger>
      </TabsList>
      <TabsContent value="produtos">
        <ProductsTab />
      </TabsContent>
      <TabsContent value="categorias">
        <CategoriesTab />
      </TabsContent>
      <TabsContent value="complementos">
        <ComplementGroupsTab />
      </TabsContent>
    </Tabs>
  </div>
</template>
```

- [ ] **Step 3: Verificar manualmente**

Run: `pnpm dev`, acesse `/admin/produtos` logado. Confirme: as três abas trocam de conteúdo, "Novo produto" abre o dialog com upload de foto funcionando (arraste uma imagem grande, confirme que o resumo "de X KB para Y KB" aparece e a foto salva), "Nova categoria" inline no formulário de produto funciona, e os checkboxes de complementos (crie um grupo antes na aba Complementos) persistem ao salvar.

- [ ] **Step 4: Commit**

```bash
git add layers/admin/app/components/admin/ProductsTab.vue layers/admin/app/pages/admin/produtos/index.vue
git commit -m "Restructure the produtos page into Produtos/Categorias/Complementos tabs"
```

---

### Task 16: Cardápio público — categorias e complementos

**Files:**
- Modify: `layers/menu/app/pages/cardapio/[slug].vue`

**Interfaces:**
- Consumes: `PublicMenuProductDto.category`/`complementGroups` (Task 3/9).

Este arquivo já foi redesenhado recentemente (busca, chips de categoria, carrossel de destaques, categorias colapsáveis com `IntersectionObserver`, dialog de detalhe do produto, banner de capa) — **não é uma reescrita do zero**. São 3 mudanças pontuais sobre o arquivo atual:
1. `product.category` deixou de ser `string | null` e passou a ser `{ id, name } | null` — todo lugar que lia `product.category` como texto agora lê `product.category?.name` (ou `?.name` no caso do `selectedProduct` no dialog).
2. O dialog de detalhe do produto ganha uma seção listando os grupos de complemento do produto (nome + opções com preço adicional), como bloco informativo — sem interação de escolha, já que não há carrinho.
3. Nada do que já existe (busca, destaques, categorias colapsáveis, observer, banner) é removido.

- [ ] **Step 1: Editar o `<script setup>`**

Troque as duas linhas que leem `product.category` como texto:

```ts
// Em `categories` (computed):
// antes:
    const key = product.category?.trim() || 'Cardápio'
// depois:
    const key = product.category?.name ?? 'Cardápio'
```

```ts
// Em `allCategoryNames` (computed):
// antes:
    names.add(product.category?.trim() || 'Cardápio')
// depois:
    names.add(product.category?.name ?? 'Cardápio')
```

Todo o resto do `<script setup>` (normalize, categorySlug, searchQuery, filteredProducts, featuredProducts, collapsedCategories, toggleCategory, activeCategory/observer, scrollToCategory, selectedProduct/detailOpen/openDetail, useHead) fica exatamente como está — eles já trabalham só com o nome (string) da categoria, que continua sendo uma string depois da mudança acima.

- [ ] **Step 2: Editar o dialog de detalhe do produto**

Ache este bloco dentro do `<template>` (dentro de `<Dialog v-model:open="detailOpen">`):

```vue
          <DialogHeader class="space-y-1 text-left">
            <DialogTitle>{{ selectedProduct.name }}</DialogTitle>
            <p v-if="selectedProduct.category" class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ selectedProduct.category }}
            </p>
          </DialogHeader>
          <p v-if="selectedProduct.description" class="text-sm text-muted-foreground">
            {{ selectedProduct.description }}
          </p>
          <div class="flex items-baseline gap-2 pt-1">
            <p v-if="selectedProduct.promoPrice" class="text-sm text-muted-foreground line-through">
              {{ formatCurrency(selectedProduct.price) }}
            </p>
            <p class="text-xl font-semibold text-primary">
              {{ formatCurrency(selectedProduct.promoPrice ?? selectedProduct.price) }}
            </p>
          </div>
```

Substitua por (só troca `selectedProduct.category` por `selectedProduct.category.name`, e soma o bloco de complementos ao final):

```vue
          <DialogHeader class="space-y-1 text-left">
            <DialogTitle>{{ selectedProduct.name }}</DialogTitle>
            <p v-if="selectedProduct.category" class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ selectedProduct.category.name }}
            </p>
          </DialogHeader>
          <p v-if="selectedProduct.description" class="text-sm text-muted-foreground">
            {{ selectedProduct.description }}
          </p>
          <div class="flex items-baseline gap-2 pt-1">
            <p v-if="selectedProduct.promoPrice" class="text-sm text-muted-foreground line-through">
              {{ formatCurrency(selectedProduct.price) }}
            </p>
            <p class="text-xl font-semibold text-primary">
              {{ formatCurrency(selectedProduct.promoPrice ?? selectedProduct.price) }}
            </p>
          </div>
          <div v-if="selectedProduct.complementGroups.length > 0" class="space-y-2 border-t pt-3">
            <div v-for="group in selectedProduct.complementGroups" :key="group.id" class="text-sm">
              <p class="font-medium text-foreground">
                {{ group.name }}<span v-if="group.isRequired" class="text-muted-foreground"> (obrigatório)</span>
              </p>
              <p class="text-muted-foreground">
                <span v-for="(option, index) in group.options" :key="option.id">
                  {{ option.name }}<template v-if="option.priceDelta > 0"> (+{{ formatCurrency(option.priceDelta) }})</template>{{ index < group.options.length - 1 ? ' · ' : '' }}
                </span>
              </p>
            </div>
          </div>
```

- [ ] **Step 3: Verificar manualmente**

Acesse `/cardapio/<slug>` de um estabelecimento com produtos em categorias diferentes e ao menos um produto com grupo de complemento vinculado.

Expected: busca, chips de categoria, carrossel de destaques e preço promocional continuam funcionando exatamente como antes; ao abrir o detalhe de um produto com categoria, o nome da categoria aparece (não `[object Object]`); um produto com complemento mostra o grupo e as opções com o preço adicional formatado em R$ no dialog de detalhe.

- [ ] **Step 4: Commit**

```bash
git add layers/menu/app/pages/cardapio/[slug].vue
git commit -m "Adapt public menu to the category entity and show complement groups in product detail"
```

---

## Self-Review

**Cobertura do spec:** modelo de dados (Task 1), storage (Task 2), tipos/schemas (Task 3), mappers/utils (Task 4), rotas de categorias/complementos/upload/produtos/menu (Tasks 5–9), UI primitives (Task 10), abas de categorias/complementos (Tasks 11–12), upload com otimização (Task 13), formulário de produto (Task 14), shell de abas (Task 15), cardápio público (Task 16). Toda seção do spec tem uma task correspondente.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo passo tem código completo.

**Consistência de tipos:** `toProductDto(row, complementGroupIds)` é chamado com a mesma assinatura nas Tasks 4 e 8; `ComplementGroupRowWithOptions`/`ProductRowWithMenuRelations`/`ProductRowWithComplementGroupIds` são definidos uma única vez na Task 3 e importados (nunca redeclarados) nas Tasks 6, 8 e 9; `CategoryDto`/`ComplementGroupDto`/`ProductDto` definidos na Task 3 são usados sem alteração de forma em todas as tasks seguintes.
