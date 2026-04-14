import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PageLoader } from './PageLoader';

export function RequireHostOrAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (loading || !user || !id) return;

      const [{ data: userRow, error: userError }, { data: hostRow, error: hostError }] = await Promise.all([
        supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle(),
        supabase.from('branded_leaderboard_hosts').select('id').eq('leaderboard_id', id).eq('user_id', user.id).maybeSingle(),
      ]);

      if (cancelled) return;

      if (userError || hostError) {
        console.error('[RequireHostOrAdmin] Failed to check access', userError ?? hostError);
        setAllowed(false);
        return;
      }

      setAllowed(Boolean(userRow?.is_admin || hostRow));
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [id, loading, user]);

  if (loading || allowed === null) {
    return <PageLoader message="Checking access..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowed) {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}
