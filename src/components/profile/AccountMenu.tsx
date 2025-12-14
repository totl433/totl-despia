import React from 'react';
import { AccountMenuItem } from './AccountMenuItem';

export interface AccountMenuProps {
  email: string;
  menuItems: Array<{
    to: string;
    icon: React.ReactNode;
    label: string;
  }>;
  onLogout: () => void;
}

export const AccountMenu = React.memo(function AccountMenu({
  email,
  menuItems,
  onLogout,
}: AccountMenuProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 overflow-hidden">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Your Account</h2>
      
      {/* Email Display */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <div className="text-base text-slate-800 break-all">{email}</div>
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
        onClick={onLogout}
        className="w-full mt-6 py-3 text-red-600 hover:text-red-700 font-semibold transition-colors underline"
      >
        Log out
      </button>
    </div>
  );
});

