alter table public.establishments
  add column logo_url text;

comment on column public.establishments.logo_url is 'Optional square logo shown as the establishment avatar on the public cardapio and admin panel.';
