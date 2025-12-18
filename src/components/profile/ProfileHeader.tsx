import React from 'react';
import { Link } from 'react-router-dom';
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
      
      {/* Stats Button */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <Link
          to="/profile/stats"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1C8376] to-[#1C8376]/90 hover:from-[#1C8376]/90 hover:to-[#1C8376] text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg group"
        >
          <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-lg">View Your Stats</span>
          <svg className="w-5 h-5 ml-auto group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
});

