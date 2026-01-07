import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../UserAvatar';

export interface ProfileAvatarProps {
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
}

export const ProfileAvatar = React.memo(function ProfileAvatar({
  name,
  email,
  size = 'md',
  editable = false,
}: ProfileAvatarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sizeMap = {
    sm: 56,
    md: 96,
    lg: 128,
  };

  const pixelSize = sizeMap[size];

  const handleAvatarClick = () => {
    if (editable && user?.id) {
      navigate('/profile/edit-avatar');
    }
  };

  // Don't render avatar if no user ID
  if (!user?.id) {
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
  }

  return (
    <div
      onClick={handleAvatarClick}
      className={`relative inline-block ${editable ? 'cursor-pointer' : ''}`}
      title={editable ? 'Click to edit avatar' : undefined}
    >
      <UserAvatar
        userId={user.id}
        name={name || email || undefined}
        size={pixelSize}
        className="mx-auto"
      />
      {editable && (
        <div
          className={`absolute bottom-0 right-0 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-slate-400 ${
            size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-8 h-8 sm:w-9 sm:h-9'
          }`}
          style={{
            transform: size === 'sm' 
              ? 'translate(-25%, -25%)' 
              : size === 'md'
              ? 'translate(-20%, -20%)'
              : 'translate(-15%, -15%)'
          }}
        >
          <svg 
            className={`text-slate-900 ${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:w-6 sm:h-6'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={size === 'sm' ? 2 : 3} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={size === 'sm' ? 2 : 3} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      )}
    </div>
  );
});

