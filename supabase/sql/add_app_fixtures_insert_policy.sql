-- Add INSERT policy for app_fixtures
-- This allows admins to insert fixtures via the API Admin page

-- Admin user IDs (from ApiAdmin.tsx)
-- 4542c037-5b38-40d0-b189-847b8f17c222
-- 36f31625-6d6c-4aa4-815a-1493a812841b

-- Allow admins to insert fixtures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_fixtures' 
    AND policyname = 'Admins can insert app_fixtures'
  ) THEN
    CREATE POLICY "Admins can insert app_fixtures" ON app_fixtures
      FOR INSERT 
      WITH CHECK (
        auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
        auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
      );
  END IF;
END $$;

-- Allow admins to update fixtures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_fixtures' 
    AND policyname = 'Admins can update app_fixtures'
  ) THEN
    CREATE POLICY "Admins can update app_fixtures" ON app_fixtures
      FOR UPDATE 
      USING (
        auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
        auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
      )
      WITH CHECK (
        auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
        auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
      );
  END IF;
END $$;

-- Allow admins to delete fixtures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'app_fixtures' 
    AND policyname = 'Admins can delete app_fixtures'
  ) THEN
    CREATE POLICY "Admins can delete app_fixtures" ON app_fixtures
      FOR DELETE 
      USING (
        auth.uid() = '4542c037-5b38-40d0-b189-847b8f17c222'::uuid OR
        auth.uid() = '36f31625-6d6c-4aa4-815a-1493a812841b'::uuid
      );
  END IF;
END $$;
