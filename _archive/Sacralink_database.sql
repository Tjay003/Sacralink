-- ============================================
-- SACRALINK DATABASE SCHEMA v2.0
-- Enhanced Production-Ready Version
-- Last Updated: 2026-01-09
-- ============================================

-- 1. ENABLE EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================
-- 2. ENUMS (Fixed Options)
-- ============================================
create type user_role as enum ('super_admin', 'admin', 'priest', 'volunteer', 'user');
create type appt_status as enum ('pending', 'approved', 'rejected', 'rescheduled', 'completed', 'cancelled');
create type sacrament_type as enum ('baptism', 'wedding', 'funeral', 'confirmation', 'counseling', 'mass_intention', 'confession', 'anointing');
create type donation_status as enum ('pending', 'verified', 'rejected');

-- ============================================
-- 3. CORE TABLES
-- ============================================

-- PROFILES (Extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique,
  full_name text,
  role user_role default 'user',
  church_id uuid,                    -- Null for regular users/super_admin
  avatar_url text,
  phone_number text,
  is_verified boolean default false, -- Admin approval for Priests/Admins
  fcm_token text,                    -- For push notifications
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- CHURCHES (Managed by Super Admin)
create table public.churches (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text not null,
  description text,
  contact_number text,
  email text,
  latitude numeric,                  -- For map integration
  longitude numeric,                 -- For map integration
  livestream_url text,               -- YouTube/FB Embed Link
  donation_qr_url text,              -- Path to Supabase Storage
  panorama_url text,                 -- Path to Supabase Storage (360 JPG)
  gcash_number text,                 -- For donation display
  maya_number text,                  -- For donation display
  operating_hours jsonb,             -- {"monday": {"open": "08:00", "close": "17:00"}, ...}
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add foreign key after churches table is created
alter table public.profiles 
  add constraint profiles_church_id_fkey 
  foreign key (church_id) references public.churches(id) on delete set null;

-- MASS SCHEDULES (Regular weekly schedules per church)
create table public.mass_schedules (
  id uuid default uuid_generate_v4() primary key,
  church_id uuid references public.churches on delete cascade not null,
  day_of_week int not null check (day_of_week >= 0 and day_of_week <= 6), -- 0=Sunday
  start_time time not null,
  end_time time not null,
  mass_type text default 'regular',  -- 'regular', 'anticipated', 'special'
  language text default 'Filipino',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- PRIEST AVAILABILITY (For AI scheduler to check)
create table public.priest_availability (
  id uuid default uuid_generate_v4() primary key,
  priest_id uuid references public.profiles on delete cascade not null,
  church_id uuid references public.churches on delete cascade not null,
  available_date date not null,
  start_time time not null,
  end_time time not null,
  is_blocked boolean default false,  -- True for vacations/unavailable
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- SERVICE DURATIONS (How long each sacrament takes)
create table public.service_durations (
  id uuid default uuid_generate_v4() primary key,
  church_id uuid references public.churches on delete cascade not null,
  service_type sacrament_type not null,
  duration_minutes int not null default 60,
  max_per_day int default 5,         -- Max appointments of this type per day
  unique(church_id, service_type)
);

-- APPOINTMENTS (The Core Feature - "AI" Scheduler)
create table public.appointments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  church_id uuid references public.churches on delete cascade not null,
  priest_id uuid references public.profiles,  -- Which priest is assigned?
  service_type sacrament_type not null,
  requested_date timestamp with time zone not null,
  end_time timestamp with time zone,          -- Calculated from duration
  status appt_status default 'pending',
  notes text,
  admin_feedback text,               -- For AI/Admin to suggest new times
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- SACRAMENT REQUIREMENTS (Documents needed per service type)
create table public.sacrament_requirements (
  id uuid default uuid_generate_v4() primary key,
  church_id uuid references public.churches on delete cascade not null,
  service_type sacrament_type not null,
  requirement_name text not null,    -- e.g., "Birth Certificate"
  description text,
  is_required boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- APPOINTMENT DOCUMENTS (User uploads for requirements)
create table public.appointment_documents (
  id uuid default uuid_generate_v4() primary key,
  appointment_id uuid references public.appointments on delete cascade not null,
  requirement_id uuid references public.sacrament_requirements,
  file_url text not null,
  file_name text,
  is_verified boolean default false,
  verified_by uuid references public.profiles,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- DONATIONS (Cashless)
create table public.donations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  church_id uuid references public.churches on delete cascade not null,
  amount numeric not null check (amount > 0),
  reference_number text,             -- GCash Ref
  proof_url text,                    -- Screenshot of receipt
  status donation_status default 'pending',
  verified_by uuid references public.profiles,
  verified_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ANNOUNCEMENTS
create table public.announcements (
  id uuid default uuid_generate_v4() primary key,
  church_id uuid references public.churches on delete cascade not null,
  title text not null,
  body text not null,
  image_url text,
  is_pinned boolean default false,
  is_active boolean default true,
  expires_at timestamp with time zone,
  created_by uuid references public.profiles,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ACTIVITY LOGS (Audit Trail)
create table public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles,
  church_id uuid references public.churches,
  action text not null,              -- 'appointment_created', 'donation_verified', etc.
  entity_type text,                  -- 'appointment', 'donation', 'church'
  entity_id uuid,
  metadata jsonb,                    -- Additional context
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ============================================
-- 4. INDEXES (Performance)
-- ============================================
create index idx_profiles_church on profiles(church_id);
create index idx_profiles_role on profiles(role);
create index idx_appointments_church on appointments(church_id);
create index idx_appointments_user on appointments(user_id);
create index idx_appointments_date on appointments(requested_date);
create index idx_appointments_status on appointments(status);
create index idx_donations_church on donations(church_id);
create index idx_donations_status on donations(status);
create index idx_announcements_church on announcements(church_id);
create index idx_mass_schedules_church on mass_schedules(church_id);
create index idx_priest_availability_priest on priest_availability(priest_id);
create index idx_priest_availability_date on priest_availability(available_date);

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table churches enable row level security;
alter table mass_schedules enable row level security;
alter table priest_availability enable row level security;
alter table service_durations enable row level security;
alter table appointments enable row level security;
alter table sacrament_requirements enable row level security;
alter table appointment_documents enable row level security;
alter table donations enable row level security;
alter table announcements enable row level security;
alter table activity_logs enable row level security;

-- PROFILES POLICIES
create policy "Users can view own profile" 
  on profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on profiles for update 
  using (auth.uid() = id);

create policy "Admins can view church members" 
  on profiles for select 
  using (
    exists (
      select 1 from profiles admin 
      where admin.id = auth.uid() 
      and admin.role in ('admin', 'super_admin', 'priest')
      and (admin.church_id = profiles.church_id OR admin.role = 'super_admin')
    )
  );

create policy "Super admins can manage all profiles" 
  on profiles for all 
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'super_admin'
    )
  );

-- CHURCHES POLICIES (Public read)
create policy "Anyone can view churches" 
  on churches for select 
  using (true);

create policy "Super admins can manage churches" 
  on churches for all 
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "Admins can update own church" 
  on churches for update 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role = 'admin' 
      and church_id = churches.id
    )
  );

-- MASS SCHEDULES POLICIES (Public read)
create policy "Anyone can view mass schedules" 
  on mass_schedules for select 
  using (true);

create policy "Admins can manage church mass schedules" 
  on mass_schedules for all 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = mass_schedules.church_id OR role = 'super_admin')
    )
  );

-- PRIEST AVAILABILITY POLICIES
create policy "Priests can view own availability" 
  on priest_availability for select 
  using (auth.uid() = priest_id);

create policy "Priests can manage own availability" 
  on priest_availability for all 
  using (auth.uid() = priest_id);

create policy "Admins can view church priest availability" 
  on priest_availability for select 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = priest_availability.church_id OR role = 'super_admin')
    )
  );

-- SERVICE DURATIONS POLICIES (Public read)
create policy "Anyone can view service durations" 
  on service_durations for select 
  using (true);

create policy "Admins can manage service durations" 
  on service_durations for all 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = service_durations.church_id OR role = 'super_admin')
    )
  );

-- APPOINTMENTS POLICIES
create policy "Users can view own appointments" 
  on appointments for select 
  using (auth.uid() = user_id);

create policy "Users can create own appointments" 
  on appointments for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own pending appointments" 
  on appointments for update 
  using (auth.uid() = user_id and status = 'pending');

create policy "Admins can view church appointments" 
  on appointments for select 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'priest', 'super_admin')
      and (church_id = appointments.church_id OR role = 'super_admin')
    )
  );

create policy "Admins can manage church appointments" 
  on appointments for all 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = appointments.church_id OR role = 'super_admin')
    )
  );

-- SACRAMENT REQUIREMENTS POLICIES (Public read)
create policy "Anyone can view sacrament requirements" 
  on sacrament_requirements for select 
  using (true);

create policy "Admins can manage sacrament requirements" 
  on sacrament_requirements for all 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = sacrament_requirements.church_id OR role = 'super_admin')
    )
  );

-- APPOINTMENT DOCUMENTS POLICIES
create policy "Users can view own appointment documents" 
  on appointment_documents for select 
  using (
    exists (
      select 1 from appointments 
      where appointments.id = appointment_documents.appointment_id 
      and appointments.user_id = auth.uid()
    )
  );

create policy "Users can upload to own appointments" 
  on appointment_documents for insert 
  with check (
    exists (
      select 1 from appointments 
      where appointments.id = appointment_documents.appointment_id 
      and appointments.user_id = auth.uid()
    )
  );

create policy "Admins can view church appointment documents" 
  on appointment_documents for select 
  using (
    exists (
      select 1 from appointments a
      join profiles p on p.id = auth.uid()
      where a.id = appointment_documents.appointment_id
      and p.role in ('admin', 'super_admin')
      and (p.church_id = a.church_id OR p.role = 'super_admin')
    )
  );

-- DONATIONS POLICIES
create policy "Users can view own donations" 
  on donations for select 
  using (auth.uid() = user_id);

create policy "Users can create donations" 
  on donations for insert 
  with check (auth.uid() = user_id);

create policy "Admins can view church donations" 
  on donations for select 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = donations.church_id OR role = 'super_admin')
    )
  );

create policy "Admins can update church donations" 
  on donations for update 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = donations.church_id OR role = 'super_admin')
    )
  );

-- ANNOUNCEMENTS POLICIES (Public read)
create policy "Anyone can view active announcements" 
  on announcements for select 
  using (is_active = true);

create policy "Admins can manage church announcements" 
  on announcements for all 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'volunteer', 'super_admin')
      and (church_id = announcements.church_id OR role = 'super_admin')
    )
  );

-- ACTIVITY LOGS POLICIES
create policy "Admins can view church activity logs" 
  on activity_logs for select 
  using (
    exists (
      select 1 from profiles 
      where id = auth.uid() 
      and role in ('admin', 'super_admin')
      and (church_id = activity_logs.church_id OR role = 'super_admin')
    )
  );

create policy "System can insert activity logs" 
  on activity_logs for insert 
  with check (true);

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure public.handle_updated_at();

create trigger churches_updated_at
  before update on churches
  for each row execute procedure public.handle_updated_at();

create trigger appointments_updated_at
  before update on appointments
  for each row execute procedure public.handle_updated_at();

create trigger announcements_updated_at
  before update on announcements
  for each row execute procedure public.handle_updated_at();

-- ============================================
-- 7. STORAGE BUCKETS (Run in Supabase Dashboard)
-- ============================================
-- These need to be created via Supabase Dashboard or API:
-- 
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('panoramas', 'panoramas', true);
-- insert into storage.buckets (id, name, public) values ('donation-qr', 'donation-qr', true);
-- insert into storage.buckets (id, name, public) values ('donation-proofs', 'donation-proofs', false);
-- insert into storage.buckets (id, name, public) values ('announcements', 'announcements', true);
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);