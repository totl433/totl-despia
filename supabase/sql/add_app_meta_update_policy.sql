-- Add UPDATE and INSERT policies for app_meta table
-- This allows admins to update current_gw when publishing gameweeks

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can update app_meta" ON app_meta;
DROP POLICY IF EXISTS "Admins can insert app_meta" ON app_meta;

-- Allow admins to update app_meta
CREATE POLICY "Admins can update app_meta" ON app_meta
  FOR UPDATE 
  USING (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  )
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

-- Allow admins to insert app_meta (for upsert operations)
CREATE POLICY "Admins can insert app_meta" ON app_meta
  FOR INSERT 
  WITH CHECK (
    auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
    auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
  );

