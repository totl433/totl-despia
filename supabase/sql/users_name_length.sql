-- Optional DB backstop for username length (does not rewrite existing short names).
-- Apply in Supabase when ready; frontend already enforces 3–18 on the next web deploy.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_name_length;

ALTER TABLE public.users
  ADD CONSTRAINT users_name_length
  CHECK (char_length(btrim(name)) BETWEEN 3 AND 18) NOT VALID;
