import { useEffect, useState, useRef } from 'react';
import { getUserAvatarUrl, getInitials, getUserAvatarColor, clearUserAvatarCache } from '../lib/userAvatars';

export interface UserAvatarProps {
  userId: string;
  name?: string | null;
  size?: number;
  className?: string;
  fallbackToInitials?: boolean;
}

/**
 * UserAvatar - Reusable component for displaying user avatars
 * Automatically fetches avatar URL and displays with fallback to initials
 */
export default function UserAvatar({
  userId,
  name,
  size = 32,
  className = '',
  fallbackToInitials = true,
}: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0); // Only update when avatar actually changes
  const loadedUrlRef = useRef<string | null>(null); // Track what URL we've loaded to prevent duplicate loads

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:28',message:'useEffect triggered',data:{userId,prevUrl:loadedUrlRef.current,avatarUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Don't try to load avatar if userId is empty
    if (!userId || userId.trim() === '') {
      setError(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    let cancelled = false;

    async function loadAvatar() {
      // Small delay to prevent rapid-fire calls
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (cancelled || !mounted) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:45',message:'loadAvatar cancelled',data:{userId,cancelled,mounted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return;
      }

      try {
        setLoading(true);
        setError(false);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:52',message:'loadAvatar calling getUserAvatarUrl',data:{userId,currentLoadedUrl:loadedUrlRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const url = await getUserAvatarUrl(userId, name);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:56',message:'loadAvatar got URL',data:{userId,url,prevLoadedUrl:loadedUrlRef.current,willUpdate:url!==loadedUrlRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (mounted && !cancelled) {
          // Only update if URL actually changed to prevent unnecessary re-renders
          if (url !== loadedUrlRef.current) {
            loadedUrlRef.current = url;
            setAvatarUrl(url);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:62',message:'Avatar URL updated',data:{userId,url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          } else {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:66',message:'Avatar URL unchanged, skipping update',data:{userId,url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          }
          setLoading(false);
        }
      } catch (err: any) {
        // Only log errors in dev mode to reduce console spam
        if (import.meta.env.DEV) {
          console.warn('[UserAvatar] Error loading avatar:', err);
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:75',message:'loadAvatar error',data:{userId,error:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        if (mounted && !cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadAvatar();

    // Listen for avatar update events
    const handleAvatarUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedUserId = customEvent.detail?.userId;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:87',message:'handleAvatarUpdate event received',data:{userId,updatedUserId,matches:updatedUserId===userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (updatedUserId === userId && mounted && !cancelled) {
        // Clear cache before reloading
        clearUserAvatarCache(userId);
        // Update cache buster with new timestamp to force image reload
        setCacheBuster(prev => prev + 1);
        // Clear the loaded URL ref to force reload
        loadedUrlRef.current = null;
        // Clear the URL to force reload
        setAvatarUrl(null);
        setLoading(true);
        loadAvatar();
      }
    };

    window.addEventListener('userAvatarUpdated', handleAvatarUpdate);

    return () => {
      mounted = false;
      cancelled = true;
      window.removeEventListener('userAvatarUpdated', handleAvatarUpdate);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:105',message:'useEffect cleanup',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    };
  }, [userId, name]);

  // Fallback to initials circle if no avatar or error
  if (error || (!avatarUrl && fallbackToInitials)) {
    const initials = getInitials(name);
    const color = getUserAvatarColor(userId);
    
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          fontSize: size * 0.4,
        }}
        title={name || undefined}
      >
        {initials}
      </div>
    );
  }

  // Show loading state
  if (loading) {
    const initials = getInitials(name);
    const color = getUserAvatarColor(userId);
    
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold animate-pulse ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          fontSize: size * 0.4,
        }}
        title={name || undefined}
      >
        {initials}
      </div>
    );
  }

  // Show avatar image
  // Add cache-busting query parameter for storage URLs to force browser refresh after updates
  const imageSrc = avatarUrl 
    ? (avatarUrl.startsWith('http') ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${cacheBuster}` : avatarUrl)
    : undefined;
  
  // #region agent log
  if (imageSrc) {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:142',message:'Rendering img element',data:{userId,imageSrc,cacheBuster,avatarUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }
  // #endregion
  
  return (
    <img
      src={imageSrc}
      alt={name ? `${name}'s avatar` : 'User avatar'}
      className={`rounded-full object-cover ${className}`}
      style={{
        width: size,
        height: size,
      }}
      onError={() => {
        // Fallback to initials on image load error
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UserAvatar.tsx:157',message:'Image load error',data:{userId,imageSrc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setError(true);
      }}
      title={name || undefined}
      loading="lazy"
      key={avatarUrl || `fallback-${userId}`} // Stable key - only changes when URL actually changes
    />
  );
}

