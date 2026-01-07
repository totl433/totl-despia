import React from 'react';
import { AccountMenuItem } from './AccountMenuItem';

export interface AccountMenuProps {
  email: string;
  menuItems: Array<{
    to: string;
    icon: React.ReactNode;
    label: string;
  }>;
  onLogout: () => Promise<void>;
}

export const AccountMenu = React.memo(function AccountMenu({
  email,
  menuItems,
  onLogout,
}: AccountMenuProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 sm:p-6 overflow-hidden">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Your Account</h2>
      
      {/* Email Display */}
      <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="text-base text-slate-800 dark:text-slate-200 break-all">{email}</div>
      </div>
      
      <div className="space-y-0">
        {menuItems.map((item, index) => (
          <AccountMenuItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            isLast={index === menuItems.length - 1}
          />
        ))}
      </div>

      {/* Sign Out Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[AccountMenu] Logout button clicked - forcing immediate logout');
          // Call logout but don't wait - force redirect immediately
          onLogout().catch(() => {
            // If logout fails, still redirect
            window.location.href = '/auth';
          });
          // Also set a backup redirect in case onLogout hangs
          setTimeout(() => {
            console.log('[AccountMenu] Backup redirect triggered');
            window.location.href = '/auth';
          }, 500);
        }}
        className="w-full mt-6 py-3 text-red-600 dark:text-red-400 font-semibold underline"
      >
        Log out
      </button>
    </div>
  );
});

