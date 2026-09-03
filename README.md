# simple-menu

Painel de gestão para estabelecimentos (restaurantes, bares, cafeterias, etc):
cardápio digital via QR code e cadastro de produtos, com estoque, comandas e
vendas planejados para as próximas etapas.

## Stack

- [Nuxt 4](https://nuxt.com) (fullstack, SSR) organizado em [layers](https://nuxt.com/docs/guide/going-further/layers)
- Tailwind CSS v4 + [shadcn-vue](https://www.shadcn-vue.com)
- Pinia
- Supabase (Postgres + Auth, com Row Level Security)

## Arquitetura

```
layers/
  base/    UI kit (shadcn), tipos e utilitários de servidor compartilhados
  auth/    Login, cadastro e sessão
  admin/   Painel autenticado (produtos)
  menu/    Cardápio público (/cardapio/[slug])
shared/    Tipos e schemas (zod) usados por app e server
supabase/migrations/  Migrations SQL versionadas
```

O front-end nunca fala diretamente com o Supabase: toda leitura e escrita
passa pelas rotas em `server/api/**` de cada layer, que usam a sessão do
usuário (via cookies) e Row Level Security para autorizar cada operação.

## Configuração

```bash
cp .env.example .env
# preencha SUPABASE_URL e SUPABASE_KEY (chave anon/publishable do projeto)
pnpm install
pnpm dev
```

Acesse `http://localhost:3000`.

## Scripts

- `pnpm dev` — servidor de desenvolvimento
- `pnpm build` — build de produção
- `pnpm nuxt typecheck` — checagem de tipos
