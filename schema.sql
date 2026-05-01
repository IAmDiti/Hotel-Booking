-- ============================================================
-- POCKET RECEPTION SAAS — Multi-tenant Schema
-- Run this in Supabase SQL editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- HOTELS (one row per hotel customer)
-- ============================================================
create table if not exists hotels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,          -- URL-safe identifier e.g. "hotel-kerchova"
  admin_pin text not null default '1234',
  cleaner_pin text not null default '0000',
  -- Hotel info (for WhatsApp messages)
  wifi_name text,
  wifi_password text,
  checkout_time text default '11:00',
  restaurant_hours text,
  extra_info text,
  -- Twilio (each hotel has their own)
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_whatsapp_from text,
  -- Status
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- ROOMS (scoped to hotel)
-- ============================================================
create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  number text not null,
  floor integer not null default 1,
  status text not null default 'free'
    check (status in ('free', 'occupied', 'dirty')),
  notes text,
  created_at timestamptz default now(),
  unique (hotel_id, number)
);

-- ============================================================
-- RESERVATIONS (scoped to hotel)
-- ============================================================
create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  room_id uuid references rooms(id) on delete set null,
  phone text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  constraint checkout_after_checkin check (check_out > check_in)
);

-- ============================================================
-- PUSH SUBSCRIPTIONS (scoped to hotel)
-- ============================================================
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  role text not null check (role in ('admin', 'cleaner')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_rooms_hotel on rooms(hotel_id);
create index if not exists idx_rooms_status on rooms(hotel_id, status);
create index if not exists idx_reservations_hotel on reservations(hotel_id);
create index if not exists idx_reservations_dates on reservations(hotel_id, check_in, check_out);
create index if not exists idx_reservations_status on reservations(hotel_id, status);
create index if not exists idx_push_hotel_role on push_subscriptions(hotel_id, role);

-- ============================================================
-- SEED: Your hotel (Hotel Kerchova)
-- ============================================================
insert into hotels (
  name, slug, admin_pin, cleaner_pin,
  wifi_name, wifi_password, checkout_time, restaurant_hours,
  twilio_whatsapp_from
) values (
  'Hotel Kerchova', 'hotel-kerchova', '1234', '0000',
  'Terasa', 'terasa12345', '11:00', '07:00-23:00',
  '+14155238886'
) on conflict (slug) do nothing;

-- Add rooms for Hotel Kerchova
insert into rooms (hotel_id, number, floor)
select h.id, r.number, r.floor
from hotels h
cross join (values
  ('101', 1), ('102', 1), ('103', 1), ('104', 1),
  ('201', 2), ('202', 2), ('203', 2), ('204', 2)
) as r(number, floor)
where h.slug = 'hotel-kerchova'
on conflict (hotel_id, number) do nothing;
