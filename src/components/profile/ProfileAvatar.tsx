import React from 'react';

export interface ProfileAvatarProps {
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const ProfileAvatar = React.memo(function ProfileAvatar({
  name,
  email,
  size = 'md',
}: ProfileAvatarProps) {
  const initial = (name || email || 'U')[0].toUpperCase();
  
  const sizeClasses = {
    sm: 'w-14 h-14 text-xl',
    md: 'w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl',
    lg: 'w-28 h-28 sm:w-32 sm:h-32 text-3xl sm:text-4xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-[#1C8376] rounded-full flex items-center justify-center text-white font-bold mx-auto`}
    >
      {initial}
    </div>
  );
});

