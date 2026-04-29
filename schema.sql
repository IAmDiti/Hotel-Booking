-- ============================================================
-- POCKET RECEPTION — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ROOMS
-- ============================================================
create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,           -- e.g. "101", "202"
  floor integer not null default 1,
  status text not null default 'free'    -- 'free' | 'occupied' | 'dirty'
    check (status in ('free', 'occupied', 'dirty')),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- RESERVATIONS
-- ============================================================
create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  room_id uuid references rooms(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  notes text,
  created_at timestamptz default now(),

  -- check_out must be after check_in
  constraint checkout_after_checkin check (check_out > check_in)
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_reservations_dates on reservations(check_in, check_out);
create index if not exists idx_reservations_status on reservations(status);
create index if not exists idx_reservations_room on reservations(room_id);
create index if not exists idx_rooms_status on rooms(status);

-- ============================================================
-- SEED DATA — delete this section after first setup
-- ============================================================
-- Insert sample rooms (adjust to your actual room numbers)
insert into rooms (number, floor, status) values
  ('101', 1, 'free'),
  ('102', 1, 'free'),
  ('103', 1, 'free'),
  ('104', 1, 'free'),
  ('201', 2, 'free'),
  ('202', 2, 'free'),
  ('203', 2, 'free'),
  ('204', 2, 'free')
on conflict (number) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- We use service key from server only, so RLS can stay off.
-- If you want extra security, enable and use service key bypass:
-- ============================================================
-- alter table rooms enable row level security;
-- alter table reservations enable row level security;
