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
