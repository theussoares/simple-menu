-- These columns were added directly against the live database by an earlier
-- feature (promo pricing, featured products, establishment cover image) and
-- were never captured in a migration. Adding them here, ordered before the
-- categories/complements migration that depends on `products` already having
-- them, so a fresh database can apply migrations in sequence.
alter table public.products add column if not exists promo_price numeric(10, 2) check (promo_price is null or promo_price >= 0);
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.establishments add column if not exists cover_image_url text;
