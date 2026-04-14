import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    (async () => {
      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.is_admin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        navigate('/profile');
      }
    })();
  }, [user, loading, navigate]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
