import React from 'react';
import { Link } from 'react-router-dom';

export interface AccountMenuItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isLast?: boolean;
}

export const AccountMenuItem = React.memo(function AccountMenuItem({
  to,
  icon,
  label,
  isLast = false,
}: AccountMenuItemProps) {
  const isExternal = to.startsWith('mailto:') || to.startsWith('http://') || to.startsWith('https://');
  
  const className = `flex items-center justify-between py-3 -mx-6 px-6 ${
    !isLast ? 'border-b border-slate-200 dark:border-slate-700' : ''
  }`;

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-slate-800 dark:text-slate-200 font-medium">{label}</span>
      </div>
      <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={to}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      to={to}
      className={className}
    >
      {content}
    </Link>
  );
});

