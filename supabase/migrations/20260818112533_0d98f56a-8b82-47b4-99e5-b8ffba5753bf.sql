CREATE TABLE public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_character text not null default 'blaze',
  guest_character text,
  status text not null default 'waiting',
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE ON public.matches TO anon;
GRANT SELECT, INSERT, UPDATE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "anyone can create matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update matches" ON public.matches FOR UPDATE USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;