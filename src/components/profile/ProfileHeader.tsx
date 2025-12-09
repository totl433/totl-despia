import React from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileStats } from './ProfileStats';

export type ProfileStatsData = {
  ocp: number;
  miniLeaguesCount: number;
  weeksStreak: number;
  loading?: boolean;
};

export interface ProfileHeaderProps {
  name?: string | null;
  email?: string | null;
  stats: ProfileStatsData | null;
  loading?: boolean;
}

export const ProfileHeader = React.memo(function ProfileHeader({
  name,
  email,
  stats,
  loading = false,
}: ProfileHeaderProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6">
      <div className="flex items-center gap-8 sm:gap-12">
        {/* Left Side: Avatar, Name */}
        <div className="flex-1 text-center">
          <div className="mb-3">
            <ProfileAvatar name={name} email={email} size="md" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate max-w-full">
            {name || 'User'}
          </h2>
        </div>
        
        {/* Right Side: Stats - exactly 50% */}
        <div className="w-1/2 flex-shrink-0">
          {stats ? (
            <ProfileStats {...stats} loading={loading} />
          ) : null}
        </div>
      </div>
    </div>
  );
});

