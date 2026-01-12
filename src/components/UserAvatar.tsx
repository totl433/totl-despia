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
          // Only update if URL actually changed to prevent unnecessary re-renders
          if (url !== loadedUrlRef.current) {
            loadedUrlRef.current = url;
            setAvatarUrl(url);
          }
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

    // Only load if we don't have this URL loaded yet
    // Check ref to avoid dependency on state
    const currentLoadedUrl = loadedUrlRef.current;
    if (!currentLoadedUrl) {
      loadAvatar();
    } else {
      // Already loaded - ensure state is consistent
      setAvatarUrl(currentLoadedUrl);
      setLoading(false);
    }

    // Listen for avatar update events
    const handleAvatarUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedUserId = customEvent.detail?.userId;
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
    };
  }, [userId, name]); // Only depend on userId and name - don't include avatarUrl or loading to prevent infinite loops

  // Calculate imageSrc early so it can be used in useEffect
  // Only add cache-busting query parameter if cacheBuster > 0 (i.e., avatar was updated)
  // This prevents the URL from changing on every render
  const imageSrc = avatarUrl 
    ? (avatarUrl.startsWith('http') && cacheBuster > 0 
        ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${cacheBuster}` 
        : avatarUrl)
    : undefined;

  // Monitor for DOM mutations that might convert src to data-src (browser extensions)
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  useEffect(() => {
    if (!imgRef.current || !imageSrc) return;
    
    const img = imgRef.current;
    let checkInterval: number | null = null;
    
    // Check periodically if src was converted to data-src
    const checkSrc = () => {
      if (!img) return;
      
      // If src is empty but data-src exists, restore it
      if (!img.src && img.hasAttribute('data-src')) {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc && dataSrc === imageSrc) {
          console.warn('[UserAvatar] Detected src->data-src conversion, restoring src for user:', userId);
          img.src = dataSrc;
          img.removeAttribute('data-src');
          img.removeAttribute('data-autoblocked');
        }
      }
      
      // If src was changed from what we set, restore it
      if (img.src && img.src !== imageSrc && !img.src.startsWith('data:')) {
        // Only restore if it's not a data URL (which would be a fallback)
        if (imageSrc && imageSrc.startsWith('http')) {
          console.warn('[UserAvatar] Detected src change, restoring original src for user:', userId);
          img.src = imageSrc;
        }
      }
    };
    
    // Check immediately and then periodically
    checkSrc();
    checkInterval = window.setInterval(checkSrc, 1000);
    
    return () => {
      if (checkInterval !== null) {
        clearInterval(checkInterval);
      }
    };
  }, [imageSrc, userId]);

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

  // Log for debugging broken images
  if (import.meta.env.DEV && imageSrc) {
    console.log('[UserAvatar] Rendering image with src:', imageSrc, 'for user:', userId);
  }
  
  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={name ? `${name}'s avatar` : 'User avatar'}
      className={`rounded-full object-cover ${className}`}
      style={{
        width: size,
        height: size,
      }}
      onError={(e) => {
        // Log error details for debugging
        const img = e.currentTarget;
        const errorDetails = {
          userId,
          name,
          expectedSrc: imageSrc,
          actualSrc: img.src,
          hasDataSrc: img.hasAttribute('data-src'),
          dataSrc: img.getAttribute('data-src'),
          dataAutoblocked: img.getAttribute('data-autoblocked'),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          currentDomain: window.location.hostname,
        };
        console.error('[UserAvatar] Image load error:', errorDetails);
        
        // If src was converted to data-src (likely CORS issue or browser extension), try to restore it
        if (img.hasAttribute('data-src') && !img.src && imageSrc) {
          console.warn('[UserAvatar] Detected src->data-src conversion, attempting to restore src');
          // Force set src attribute directly
          img.setAttribute('src', imageSrc);
          // Remove data-src to prevent interference
          img.removeAttribute('data-src');
          // Remove autoblocked attribute
          img.removeAttribute('data-autoblocked');
          // Don't set error yet - give it a chance to load
          return;
        }
        
        // Check if this might be a CORS issue (Supabase storage URL failing on playtotl.com)
        if (imageSrc && imageSrc.includes('supabase.co/storage') && window.location.hostname === 'playtotl.com') {
          console.error('[UserAvatar] Possible CORS issue: Supabase storage image failed on playtotl.com');
          console.error('[UserAvatar] Action required: Update Supabase Storage CORS settings to allow playtotl.com');
        }
        
        // Fallback to initials on image load error
        setError(true);
      }}
      onLoad={() => {
        // Log successful load for debugging
        if (import.meta.env.DEV) {
          console.log('[UserAvatar] Image loaded successfully:', imageSrc, 'for user:', userId);
        }
      }}
      title={name || undefined}
      loading="lazy"
      key={`${userId}-${avatarUrl || 'fallback'}`} // Stable key based on userId and URL
    />
  );
}

