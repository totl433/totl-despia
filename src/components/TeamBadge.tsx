import { useState } from 'react';
import ClubBadge from './ClubBadge';

export type TeamBadgeProps = {
  code?: string | null;
  crest?: string | null;  // API crest URL (optional)
  size?: number;
  className?: string;
};

/**
 * Team badge component with fallback logic:
 * 1. Tries to use API crest URL if provided
 * 2. Falls back to ClubBadge if crest fails or not provided
 * 3. Falls back to placeholder if no code available
 */
export default function TeamBadge({ 
  code, 
  crest, 
  size = 22, 
  className = "" 
}: TeamBadgeProps) {
  const [imageError, setImageError] = useState(false);
  
  // If we have a crest URL and haven't errored, use it
  if (crest && !imageError) {
    return (
      <img
        src={crest}
        alt={`${code || 'Team'} badge`}
        width={size}
        height={size}
        className={`rounded object-contain inline-block align-middle select-none ${className}`}
        loading="lazy"
        onError={() => {
          // Fall back to ClubBadge if crest URL fails
          setImageError(true);
        }}
      />
    );
  }
  
  // Fall back to ClubBadge if we have a code
  if (code) {
    return <ClubBadge code={code} size={size} className={className} />;
  }
  
  // Fallback placeholder
  return (
    <div 
      className={`rounded bg-slate-200 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}



