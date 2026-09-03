-- Establishments (tenants). Each establishment belongs to exactly one owner user.
-- MVP keeps a 1:1 owner -> establishment relationship; multi-user establishments
-- can be introduced later without breaking this shape.
create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  segment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index establishments_owner_id_key on public.establishments (owner_id);

comment on table public.establishments is 'A tenant business (restaurant, bar, cafe, etc). One per owner user for now.';
comment on column public.establishments.segment is 'Free-form business type (e.g. restaurante, bar, cafeteria) - intentionally not an enum.';

-- Products belong to an establishment and make up its cardapio (menu).
create table public.products (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  price numeric(10, 2) not null check (price >= 0),
  cost numeric(10, 2) check (cost is null or cost >= 0),
  category text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_establishment_id_idx on public.products (establishment_id);
create index products_establishment_active_idx on public.products (establishment_id, is_active);

comment on column public.products.cost is 'Unit cost, used later for profit/margin reporting. Not shown on the public menu.';

-- Keep updated_at accurate on every row change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger establishments_set_updated_at
  before update on public.establishments
  for each row
  execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- Row Level Security -------------------------------------------------------

alter table public.establishments enable row level security;
alter table public.products enable row level security;

-- Establishment name/slug/segment are not sensitive and must be readable
-- anonymously so the public cardapio page can resolve a slug to a name.
create policy "establishments_public_read"
  on public.establishments for select
  to anon, authenticated
  using (true);

create policy "establishments_owner_insert"
  on public.establishments for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "establishments_owner_update"
  on public.establishments for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "establishments_owner_delete"
  on public.establishments for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Anyone can read active products (the public cardapio QR flow is anonymous).
create policy "products_public_read_active"
  on public.products for select
  to anon, authenticated
  using (is_active = true);

-- Owners can read all of their own products, including inactive ones.
create policy "products_owner_read_all"
  on public.products for select
  to authenticated
  using (
    establishment_id in (
      select id from public.establishments where owner_id = (select auth.uid())
    )
  );

create policy "products_owner_insert"
  on public.products for insert
  to authenticated
  with check (
    establishment_id in (
      select id from public.establishments where owner_id = (select auth.uid())
    )
  );

create policy "products_owner_update"
  on public.products for update
  to authenticated
  using (
    establishment_id in (
      select id from public.establishments where owner_id = (select auth.uid())
    )
  )
  with check (
    establishment_id in (
      select id from public.establishments where owner_id = (select auth.uid())
    )
  );

create policy "products_owner_delete"
  on public.products for delete
  to authenticated
  using (
    establishment_id in (
      select id from public.establishments where owner_id = (select auth.uid())
    )
  );
