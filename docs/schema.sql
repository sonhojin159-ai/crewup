-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT NOT NULL,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crews table
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  max_members INTEGER NOT NULL DEFAULT 10,
  role_type TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crew Members table (M2M)
CREATE TABLE IF NOT EXISTS public.crew_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, rejected
  role TEXT NOT NULL DEFAULT 'member', -- member, owner
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(crew_id, user_id)
);

-- RLS Policies
-- DROP existing policies first to avoid "already exists" errors, then recreate

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view, only owner can edit
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Crews: Anyone can view, only authenticated can create, owner can edit
DROP POLICY IF EXISTS "Crews are viewable by everyone" ON public.crews;
CREATE POLICY "Crews are viewable by everyone" ON public.crews
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create crews" ON public.crews;
CREATE POLICY "Authenticated users can create crews" ON public.crews
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Owners can update their crews" ON public.crews;
CREATE POLICY "Owners can update their crews" ON public.crews
  FOR UPDATE USING (auth.uid() = created_by);

-- Crew Members: Anyone can view, auth can insert (apply), owner can update (approve)
DROP POLICY IF EXISTS "Crew members are viewable by everyone" ON public.crew_members;
CREATE POLICY "Crew members are viewable by everyone" ON public.crew_members
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can apply for crews" ON public.crew_members;
CREATE POLICY "Authenticated users can apply for crews" ON public.crew_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Crew owners can manage members" ON public.crew_members;
CREATE POLICY "Crew owners can manage members" ON public.crew_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.crews
      WHERE id = crew_members.crew_id AND created_by = auth.uid()
    )
  );

-- Function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'Guest'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
