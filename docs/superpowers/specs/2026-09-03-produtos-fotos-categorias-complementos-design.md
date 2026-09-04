# Produtos: upload de foto otimizado, categorias e complementos

Status: approved for planning
Date: 2026-09-03

## Contexto

O cadastro de produto (`layers/admin/app/components/admin/ProductFormDialog.vue`)
está abaixo do padrão de mercado: a imagem é um campo de texto para colar uma
URL já hospedada em outro lugar, a categoria é texto livre sem nenhuma gestão,
e não existe suporte a complementos/variações (ex: tamanho, adicionais).

Pesquisa rápida em iFood, Anota AI e Goomer mostra um padrão comum: a foto é o
elemento central do cadastro (upload com preview, não URL manual), a
categoria é uma entidade reaproveitável, e complementos são grupos
reutilizáveis entre produtos.

O app hoje não tem carrinho/pedido — `/cardapio/[slug]` é uma vitrine
somente leitura (QR code). Complementos, portanto, são modelados já pensando
em um pedido futuro (preço por opção, para permitir soma de total), mas sem
construir checkout agora.

## Decisões já tomadas (não reabrir sem motivo novo)

- Categorias existentes (texto livre) são migradas automaticamente: cada
  valor distinto vira uma linha em `categories`, e os produtos são religados
  por id.
- Grupos de complemento são reaproveitáveis entre produtos do mesmo
  estabelecimento (não um-para-um com o produto).
- Limpeza de imagem órfã no storage entra neste mesmo pacote de trabalho.
- Upload de imagem substitui totalmente o campo de URL manual.
- Categorias/complementos ficam em abas dentro da página Produtos
  (`Produtos | Categorias | Complementos`), não em itens novos no menu
  lateral.

## Modelo de dados

Nova migration em `supabase/migrations/`, seguindo o estilo da migration
existente (`20260903000001_init_establishments_products.sql`): tabelas,
índices, trigger de `updated_at`, RLS habilitado com policies explícitas.

### `categories`

```sql
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
```

### `products` (alteração)

- Adiciona `category_id uuid references public.categories (id) on delete set null`.
- Remove a coluna `category` (text) após o backfill.
- Backfill, na mesma migration:
  1. `insert into categories (establishment_id, name) select distinct establishment_id, trim(category) from products where category is not null and trim(category) <> ''`
  2. `update products set category_id = categories.id from categories where products.establishment_id = categories.establishment_id and lower(trim(products.category)) = lower(categories.name)`
  3. `alter table products drop column category`

### `complement_groups`

```sql
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
```

`max_select null` = sem limite superior. `is_required` combinado com
`min_select = 0` é inconsistente — a validação de `min_select >= 1` quando
`is_required = true` fica no schema Zod da API (mais simples que um check
constraint cruzado).

### `complement_options`

```sql
create table public.complement_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.complement_groups (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  price_delta numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index complement_options_group_id_idx on public.complement_options (group_id);
```

### `product_complement_groups`

```sql
create table public.product_complement_groups (
  product_id uuid not null references public.products (id) on delete cascade,
  group_id uuid not null references public.complement_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, group_id)
);
```

### RLS (todas as quatro tabelas)

Mesmo padrão de `products`/`establishments`: leitura pública liberada
(nome de categoria/complemento não é dado sensível — só produto inativo é
oculto), escrita restrita ao dono do estabelecimento.

Segue o mesmo estilo de `products` na migration existente: uma policy por
operação (`select`/`insert`/`update`/`delete`), não uma única `for all`.

```sql
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

-- complement_groups: as mesmas 4 policies, trocando "categories" por
-- "complement_groups" (establishment_id é uma coluna direta da tabela).

-- complement_options: mesmas 4 policies, mas o using/with check troca
-- "establishment_id in (...)" por:
--   group_id in (
--     select id from public.complement_groups
--     where establishment_id in (select id from public.establishments where owner_id = (select auth.uid()))
--   )

-- product_complement_groups: mesmas 4 policies, com o using/with check
-- verificando product_id in (select id from public.products where
-- establishment_id in (select id from public.establishments where owner_id
-- = (select auth.uid()))).
```

### Storage: bucket `product-images`

Nova migration (ou a mesma) cria o bucket via `storage.buckets` insert e
policies em `storage.objects`:

- Leitura pública (`select` para `anon, authenticated`, `using (bucket_id = 'product-images')`).
- Escrita (`insert`/`update`/`delete`) restrita a `authenticated` cujo
  primeiro segmento do path (`storage.foldername(name)[1]`) seja o id de um
  estabelecimento que o usuário possui.

## Backend (server routes)

Todas seguem o padrão existente: `defineEventHandler`, `requireEstablishment`,
Zod para validar body, `logServerError` + `createError` em falha.

### Categorias — `layers/admin/server/api/admin/categories/`
- `index.get.ts` — lista categorias do estabelecimento, ordenadas por `sort_order`.
- `index.post.ts` — cria (`name`).
- `[id].patch.ts` — renomeia / reordena.
- `[id].delete.ts` — exclui; se houver produtos vinculados, o `on delete set null`
  do schema já resolve (produto fica sem categoria), sem precisar bloquear no
  backend — mas o admin avisa antes de confirmar (ver seção UI).

### Complementos — `layers/admin/server/api/admin/complement-groups/`
- `index.get.ts` — lista grupos com suas opções (join).
- `index.post.ts` — cria grupo + opções em uma chamada, com dois inserts
  sequenciais (grupo, depois opções). Sem RPC/transação: o volume de escrita
  nesta tela é baixo e, no pior caso de falha entre os dois inserts, o grupo
  fica sem opções — visível e corrigível na própria tela de edição, não vale
  a complexidade de uma função Postgres para isso agora.
- `[id].patch.ts` — atualiza grupo e substitui o conjunto de opções (delete +
  insert das opções é mais simples que diff).
- `[id].delete.ts` — exclui grupo (cascade remove opções e vínculos).

### Produtos (ajustes)
- `productSchema`: troca `category: string` por `categoryId: string().uuid().nullable()`;
  remove `imageUrl` como campo digitável livre (continua existindo no DTO,
  mas passa a ser preenchido só pelo fluxo de upload) e some com validação de
  URL para aceitar tanto a nossa URL de storage quanto uma URL externa legada.
- `index.post.ts` / `[id].patch.ts`: passam `category_id` em vez de `category`;
  ao atualizar imagem, se a antiga pertencia ao bucket `product-images` e é
  diferente da nova, chama a limpeza de storage (ver abaixo) depois do save
  ter sucesso.
- `[id].delete.ts`: antes (ou depois) de excluir a linha, apaga a imagem do
  storage se ela pertencer ao bucket.
- Novo: aceitar/retornar `complementGroupIds: string[]` no create/update para
  gravar as linhas de `product_complement_groups` (delete + insert do
  conjunto, mesma lógica simples de "substituir tudo").

### Upload de imagem — `layers/admin/server/api/admin/products/upload-image.post.ts`
- Recebe multipart (`readMultipartFormData`), pega o primeiro arquivo,
  valida `content-type` (`image/webp` esperado, já que o cliente converte
  antes de enviar) e tamanho máximo (ex: 2MB de sobra de segurança, mesmo já
  vindo otimizado).
- `requireEstablishment(event)` para autenticar e obter `establishment.id`.
- Sobe para `product-images/{establishment.id}/{randomUUID()}.webp` via
  `client.storage.from('product-images').upload(...)`.
- Retorna `{ url: string }` (URL pública via `getPublicUrl`).

### Util de limpeza de storage
`layers/base/server/utils/product-images.ts`:
```ts
export function extractStoragePath(imageUrl: string): string | null
export async function deleteProductImageIfOwned(client, imageUrl: string | null): Promise<void>
```
`extractStoragePath` retorna `null` se a URL não for do nosso bucket (ex:
imagem legada com URL externa) — nesse caso a função de delete simplesmente
não faz nada, preservando compatibilidade com produtos antigos.

## Frontend — Admin

### `layers/admin/app/pages/admin/produtos/index.vue`
Vira um shell com abas (usando o componente `Tabs` do reka-ui, já que o
projeto usa shadcn-vue): **Produtos** (conteúdo atual), **Categorias**,
**Complementos**. Cada aba é um componente próprio para manter os arquivos
pequenos:
- `ProductsTab.vue` (conteúdo hoje na página, movido)
- `CategoriesTab.vue`
- `ComplementGroupsTab.vue`

### Stores novas (padrão Pinia igual `useProductsStore`)
- `useCategoriesStore` — `fetchAll/create/update/remove`.
- `useComplementGroupsStore` — idem, com opções aninhadas no objeto do grupo.

### `CategoriesTab.vue`
Lista simples (nome, ordem, ações editar/excluir). Excluir mostra um
`AlertDialog` avisando "N produtos ficarão sem categoria" quando aplicável
(a store calcula isso a partir de `useProductsStore` já carregado, sem novo
endpoint).

### `ComplementGroupsTab.vue`
Lista de grupos em accordion; cada grupo expande para mostrar/editar suas
opções (nome + preço adicional) inline, mais os campos do grupo (obrigatório,
min/max). Criar/editar via um dialog único `ComplementGroupFormDialog.vue`
(nome, obrigatório, min, max, lista dinâmica de opções nome+preço).

### `ProductFormDialog.vue` (reescrito)
Ordem dos campos, seguindo a pesquisa: **imagem → nome → descrição → preço/custo
→ categoria → complementos → disponibilidade**.
- `ProductImageUpload.vue` no topo: mostra a imagem atual (se houver),
  dropzone/clique para trocar, preview local imediato, indicador de
  progresso durante upload, e texto "fotos aumentam a conversão em até 40%"
  como reforço (dado da pesquisa).
- Categoria vira um `Select` populado por `useCategoriesStore`, com uma
  opção "+ Nova categoria" que abre um input inline (cria via store e
  seleciona automaticamente) — evita sair do formulário do produto.
- Complementos: lista de checkboxes (um por grupo existente) com link
  "gerenciar complementos" que leva à aba Complementos.

### `ProductImageUpload.vue` — otimização client-side
```
1. input[type=file accept=image/*] ou drag&drop
2. Ler arquivo -> createImageBitmap (ou HTMLImageElement + onload)
3. Calcular dimensão alvo: maior lado <= 1000px, mantendo aspect ratio
   (se a imagem já for menor, não upscala)
4. Desenhar em <canvas> nessas dimensões
5. canvas.toBlob(blob, 'image/webp', quality) com quality inicial 0.82
6. Se blob.size > 300KB, reduzir quality em passos (0.82 -> 0.7 -> 0.6),
   máximo 3 tentativas, aceitando o resultado da última tentativa mesmo
   que ainda esteja acima do limite (nunca trava o usuário)
7. Mostrar preview do blob final + "de X KB para Y KB"
8. No submit do form (ou ao confirmar a imagem), faz upload via
   FormData para /api/admin/products/upload-image; recebe a URL e
   preenche form.imageUrl
```
Sem libs novas (Canvas API é nativa do browser). Fallback: navegadores muito
antigos sem suporte a `image/webp` no `toBlob` retornam PNG automaticamente
(comportamento nativo do browser) — não precisa tratamento extra.

## Cardápio público (`layers/menu`)

- `PublicMenuDto`/`PublicMenuProductDto`: `category` (string) vira `category:
  { id, name } | null`; novo campo `complementGroups: { id, name, isRequired,
  options: { id, name, priceDelta }[] }[]`.
- `server/api/menu/[slug].get.ts`: troca o select simples por um select com
  joins (`categories(name, sort_order)`, e uma segunda query — ou um
  `select` aninhado do PostgREST — para `product_complement_groups ->
  complement_groups -> complement_options`).
- `pages/cardapio/[slug].vue`: agrupa por `category.sort_order` (fallback
  "Cardápio" para produtos sem categoria, ordenado por último); dentro do
  card do produto, se houver `complementGroups`, lista cada grupo com suas
  opções e preço adicional (`+ R$ x,xx`) — texto informativo, sem interação
  de seleção (não há carrinho ainda).

## Fora de escopo (não construir agora)

- Checkout/carrinho e cálculo de total real (o schema já suporta quando
  existir).
- Reordenar categorias/opções por drag-and-drop (usa input numérico de
  `sort_order` por enquanto).
- Duplicar/"copiar" grupo de complemento (o modelo já é reaproveitável por
  vínculo direto, então "copiar" não é necessário — só vincular).

## Testes

- Migration: aplicar em ambiente local/dev e conferir o backfill de
  categorias com dados de exemplo (produtos com categorias repetidas e
  vazias).
- Rotas novas (`categories`, `complement-groups`, `upload-image`): cobrir
  RLS (dono consegue, outro usuário autenticado não consegue) seguindo o
  padrão de teste já usado nas rotas de produto, se houver suíte
  automatizada — caso contrário, verificação manual documentada no PR.
- Client: fluxo manual completo no navegador — criar categoria inline,
  criar grupo de complemento com opções, vincular a um produto, subir uma
  foto grande (>2MB) e confirmar que o upload final é WebP pequeno, ver o
  resultado em `/cardapio/[slug]`.
