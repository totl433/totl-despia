import { useEffect, useState } from 'react';
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
  const [cacheBuster, setCacheBuster] = useState(Date.now()); // Timestamp-based cache-busting

  useEffect(() => {
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
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const url = await getUserAvatarUrl(userId, name);
        if (mounted && !cancelled) {
          setAvatarUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        // Only log errors in dev mode to reduce console spam
        if (import.meta.env.DEV) {
          console.warn('[UserAvatar] Error loading avatar:', err);
        }
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
      if (updatedUserId === userId && mounted && !cancelled) {
        // Clear cache before reloading
        clearUserAvatarCache(userId);
        // Update cache buster with new timestamp to force image reload
        setCacheBuster(Date.now());
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
        setError(true);
      }}
      title={name || undefined}
      loading="lazy"
      key={`${avatarUrl}-${cacheBuster}`} // Force React to remount img element when URL or cache buster changes
    />
  );
}

