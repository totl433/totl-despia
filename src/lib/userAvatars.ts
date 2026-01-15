import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

function withVersionParam(url: string, version: string | number): string {
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`;
}

/**
 * Large color palette for avatar backgrounds
 * Ensures good contrast with white text for initials
 */
export const AVATAR_COLORS = [
  '#1C8376', // TOTL brand color (teal)
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#DC2626', // Red
  '#EA580C', // Orange
  '#CA8A04', // Yellow
  '#059669', // Emerald
  '#0891B2', // Cyan
  '#DB2777', // Pink
  '#BE185D', // Rose
  '#9333EA', // Violet
  '#4F46E5', // Indigo
  '#0EA5E9', // Sky
  '#14B8A6', // Teal
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red-500
  '#8B5CF6', // Purple-500
  '#06B6D4', // Cyan-500
  '#84CC16', // Lime
  '#F97316', // Orange-500
  '#EC4899', // Pink-500
  '#6366F1', // Indigo-500
  '#14B8A6', // Teal-500
  '#A855F7', // Purple-600
  '#3B82F6', // Blue-500
  '#10B981', // Green-500
  '#F59E0B', // Amber-500
  '#EF4444', // Red-500
  '#8B5CF6', // Purple-500
] as const;

/**
 * Simple hash function to convert a string to a number
 * Ensures deterministic color selection for the same user
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get initials from a name (single or double initial)
 * Reuses the logic from existing initials() helper
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get a deterministic color for a user based on their ID
 * Ensures the same user always gets the same color
 */
export function getUserAvatarColor(userId: string): string {
  const hash = hashString(userId);
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Generate an avatar image using Canvas API
 * Creates a circular avatar with colored background and white initials
 */
export async function generateAvatarImage(
  initials: string,
  color: string,
  size: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Draw circular background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw initials text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.4}px Gramatika, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Generate and upload a default avatar for a user
 * Creates avatar with user's initials and deterministic color
 */
export async function generateAndUploadDefaultAvatar(
  userId: string,
  userName: string | null | undefined
): Promise<string> {
  try {
    // Get initials and color
    const initials = getInitials(userName);
    const color = getUserAvatarColor(userId);

    // Generate avatar image (200x200 for good quality)
    const avatarBlob = await generateAvatarImage(initials, color, 200);

    // Upload to Supabase Storage
    // Store in user-specific folder: {userId}/avatar.png
    // This makes RLS policies easier to write
    const fileExt = 'png';
    const fileName = `avatar.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, avatarBlob, {
        contentType: 'image/png',
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      // Only log in dev mode to reduce console spam
      if (import.meta.env.DEV) {
        console.warn('[userAvatars] Failed to upload avatar:', uploadError);
      }
      throw uploadError;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    const avatarUrl = withVersionParam(data.publicUrl, Date.now());
    
    // Log URL for debugging
    if (import.meta.env.DEV) {
      console.log('[userAvatars] Generated default avatar URL:', avatarUrl, 'for user:', userId);
    }

    // Save URL to users table (UPDATE only - user must already exist)
    const { error: dbError } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
      })
      .eq('id', userId);

    if (dbError) {
      // Only log in dev mode to reduce console spam
      if (import.meta.env.DEV) {
        console.warn('[userAvatars] Failed to save avatar URL:', dbError);
      }
      // Don't throw - avatar is uploaded, just DB update failed
    }

    return avatarUrl;
  } catch (error) {
    // Only log in dev mode to reduce console spam
    if (import.meta.env.DEV) {
      console.warn('[userAvatars] Error generating avatar:', error);
    }
    throw error;
  }
}

/**
 * Upload a custom avatar image for a user
 * Handles image compression and upload
 */
export async function uploadUserAvatar(
  userId: string,
  imageFile: File
): Promise<string> {
  try {
    // Compress image using browser-image-compression (same as league avatars)
    const compressedFile = await imageCompression(imageFile, {
      maxSizeMB: 0.5, // Max 500KB
      maxWidthOrHeight: 400, // Max 400px
      useWebWorker: true,
      initialQuality: 0.8,
    });

    // Upload to Supabase Storage
    // Store in user-specific folder: {userId}/avatar.{ext}
    const fileExt = imageFile.name.split('.').pop() || 'png';
    const fileName = `avatar.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, compressedFile, {
        contentType: compressedFile.type,
        upsert: true,
      });

    if (uploadError) {
      // Only log in dev mode to reduce console spam
      if (import.meta.env.DEV) {
        console.warn('[userAvatars] Failed to upload avatar:', uploadError);
      }
      throw uploadError;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath);

    // Add a version param so caches (browser/WebView/CDN) can't stick to an old image.
    const avatarUrl = withVersionParam(data.publicUrl, Date.now());
    
    // Log URL for debugging
    if (import.meta.env.DEV) {
      console.log('[userAvatars] Uploaded custom avatar URL:', avatarUrl, 'for user:', userId);
    }

    // Save URL to users table (UPDATE only - user must already exist)
    const { error: dbError } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
      })
      .eq('id', userId);

    if (dbError) {
      console.error('[userAvatars] Failed to save avatar URL:', dbError);
      throw dbError;
    }

    return avatarUrl;
  } catch (error) {
    console.error('[userAvatars] Error uploading avatar:', error);
    throw error;
  }
}


/**
 * Validate that an avatar URL is a valid Supabase storage URL or data URL
 */
function isValidAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Check if it's a data URL (fallback avatars)
  if (url.startsWith('data:image/')) return true;
  // Check if it's a valid Supabase storage URL
  if (url.includes('supabase.co/storage/v1/object/public/user-avatars/')) return true;
  // Log invalid URLs for debugging
  if (import.meta.env.DEV) {
    console.warn('[userAvatars] Invalid avatar URL format:', url);
  }
  return false;
}

/**
 * Get the avatar URL for a user
 * Returns the stored avatar URL, or generates a default if none exists
 */
// Cache to prevent repeated avatar generation attempts
const avatarGenerationCache = new Map<string, Promise<string>>();
const failedAvatarCache = new Set<string>();

// Function to clear cache for a user (called when avatar is updated)
export function clearUserAvatarCache(userId: string) {
  avatarGenerationCache.delete(userId);
  failedAvatarCache.delete(userId);
}

export async function getUserAvatarUrl(
  userId: string,
  userName: string | null | undefined
): Promise<string> {
  // If we've already failed to generate for this user, skip and use fallback
  if (failedAvatarCache.has(userId)) {
    const initials = getInitials(userName);
    const color = getUserAvatarColor(userId);
    return generateDataUrlAvatar(initials, color);
  }

  // If there's already a generation in progress, wait for it
  if (avatarGenerationCache.has(userId)) {
    try {
      return await avatarGenerationCache.get(userId)!;
    } catch {
      // If generation failed, use fallback
      const initials = getInitials(userName);
      const color = getUserAvatarColor(userId);
      return generateDataUrlAvatar(initials, color);
    }
  }

  const generationPromise = (async () => {
    try {
      // Check if user has an avatar URL in database
      const { data, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      // If user doesn't exist in users table, use fallback immediately
      if (error && error.code === 'PGRST116') {
        // User doesn't exist - use fallback without trying to generate
        failedAvatarCache.add(userId);
        const initials = getInitials(userName);
        const color = getUserAvatarColor(userId);
        return generateDataUrlAvatar(initials, color);
      }

      if (error) {
        // Other errors - use fallback
        if (import.meta.env.DEV) {
          console.warn('[userAvatars] Error fetching avatar URL:', error);
        }
        failedAvatarCache.add(userId);
        const initials = getInitials(userName);
        const color = getUserAvatarColor(userId);
        return generateDataUrlAvatar(initials, color);
      }

      // If no data returned, user doesn't exist - use fallback
      if (!data) {
        failedAvatarCache.add(userId);
        const initials = getInitials(userName);
        const color = getUserAvatarColor(userId);
        return generateDataUrlAvatar(initials, color);
      }

      // If avatar URL exists, validate and return it
      if (data.avatar_url) {
        // Validate URL format
        if (!isValidAvatarUrl(data.avatar_url)) {
          console.warn('[userAvatars] Invalid avatar URL format for user:', userId, 'URL:', data.avatar_url);
          // Use fallback instead of invalid URL
          failedAvatarCache.add(userId);
          const initials = getInitials(userName);
          const color = getUserAvatarColor(userId);
          return generateDataUrlAvatar(initials, color);
        }
        // Log URL for debugging broken images
        if (import.meta.env.DEV) {
          console.log('[userAvatars] Found avatar URL for user:', userId, 'URL:', data.avatar_url);
        }
        return data.avatar_url;
      }

      // User exists but no avatar - only try to generate if this is the current logged-in user
      // We cannot generate avatars for other users due to RLS policies
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const isCurrentUser = currentUserId === userId;
      
      if (!isCurrentUser) {
        // Not the current user - use fallback data URL instead of trying to generate
        failedAvatarCache.add(userId);
        const initials = getInitials(userName);
        const color = getUserAvatarColor(userId);
        return generateDataUrlAvatar(initials, color);
      }
      
      // Only generate for current user
      try {
        return await generateAndUploadDefaultAvatar(userId, userName);
      } catch (genError: any) {
        // Generation failed - mark as failed and use fallback
        if (import.meta.env.DEV) {
          console.warn('[userAvatars] Failed to generate avatar for user:', userId);
        }
        failedAvatarCache.add(userId);
        const initials = getInitials(userName);
        const color = getUserAvatarColor(userId);
        return generateDataUrlAvatar(initials, color);
      }
    } catch (error: any) {
      // Any other error - use fallback silently
      failedAvatarCache.add(userId);
      const initials = getInitials(userName);
      const color = getUserAvatarColor(userId);
      return generateDataUrlAvatar(initials, color);
    } finally {
      // Clean up cache after a delay
      setTimeout(() => {
        avatarGenerationCache.delete(userId);
      }, 60000); // Remove after 60 seconds
    }
  })();

  avatarGenerationCache.set(userId, generationPromise);
  return generationPromise;
}

/**
 * Generate a data URL for an avatar (fallback)
 * Used when we can't upload to storage
 */
function generateDataUrlAvatar(initials: string, color: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('[userAvatars] Could not get canvas context for data URL avatar');
      return '';
    }

    // Draw circular background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.fill();

    // Draw initials
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 80px Gramatika, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 100);

    const dataUrl = canvas.toDataURL('image/png');
    if (import.meta.env.DEV) {
      console.log('[userAvatars] Generated data URL avatar for initials:', initials);
    }
    return dataUrl;
  } catch (error) {
    console.error('[userAvatars] Error generating data URL avatar:', error);
    return '';
  }
}

/**
 * Delete a user's avatar (revert to default)
 */
export async function deleteUserAvatar(userId: string): Promise<void> {
  try {
    // Delete from storage (using folder structure: {userId}/avatar.{ext})
    const filePaths = [
      `${userId}/avatar.png`,
      `${userId}/avatar.jpg`,
      `${userId}/avatar.jpeg`,
      `${userId}/avatar.webp`,
    ];
    
    const { error: storageError } = await supabase.storage
      .from('user-avatars')
      .remove(filePaths);

    if (storageError) {
      // Only log in dev mode to reduce console spam
      if (import.meta.env.DEV) {
        console.warn('[userAvatars] Error deleting avatar from storage:', storageError);
      }
    }

    // Remove URL from database and mark as deleted to prevent auto-regeneration
    // We'll use a special marker value to indicate "user deleted, don't auto-generate"
    const { error: dbError } = await supabase
      .from('users')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (dbError) {
      console.error('[userAvatars] Error removing avatar URL:', dbError);
      throw dbError;
    }
    
    // Clear cache to ensure fresh fetch
    clearUserAvatarCache(userId);
  } catch (error) {
    console.error('[userAvatars] Error deleting avatar:', error);
    throw error;
  }
}

