-- Case-insensitive unique usernames.
-- Blank names are excluded so incomplete profiles can exist without colliding.

CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique_ci
ON public.users (lower(trim(name)))
WHERE length(trim(name)) > 0;
