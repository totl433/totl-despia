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
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mb-6 overflow-hidden">
      <div className="flex items-center gap-4 sm:gap-6 md:gap-8 lg:gap-12">
        {/* Left Side: Avatar, Name */}
        <div className="flex-1 min-w-0 text-center">
          <div className="mb-3">
            <ProfileAvatar name={name} email={email} size="md" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate max-w-full">
            {name || 'User'}
          </h2>
        </div>
        
        {/* Right Side: Stats */}
        <div className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-1/2">
          {stats ? (
            <ProfileStats {...stats} loading={loading} />
          ) : null}
        </div>
      </div>
    </div>
  );
});

