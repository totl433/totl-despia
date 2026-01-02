-- Create Volley user for chat messages
-- Volley is a bot that sends automatic announcements

-- First, ensure Volley exists in public.users
INSERT INTO public.users (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Volley')
ON CONFLICT (id) DO UPDATE SET name = 'Volley';

-- Note: If league_messages.user_id has a foreign key to auth.users,
-- we may need to create Volley in auth.users as well, or modify the constraint.
-- For now, this should work if the constraint is to public.users

