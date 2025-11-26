import { Link } from 'react-router-dom';

export type LeaderCardProps = {
  title: string;
  icon: React.ReactNode;
  subtitle?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  className?: string;
  to?: string;
  compactFooter?: boolean;
};

/**
 * Card component for leaderboard links (Global, Mini Leagues, etc.)
 */
export default function LeaderCard({ 
  title, 
  icon, 
  subtitle, 
  footerLeft, 
  footerRight, 
  className, 
  to, 
  compactFooter 
}: LeaderCardProps) {
  const inner = (
    <div className={"h-full rounded-3xl border-2 border-[#1C8376]/20 bg-slate-50/80 p-4 sm:p-6 " + (className ?? "")}>
      <div className="flex items-start gap-3">
        <div className={"rounded-full bg-white shadow-inner flex items-center justify-center flex-shrink-0 " + (compactFooter ? "h-12 w-12 sm:h-14 sm:w-14" : "h-14 w-14 sm:h-16 sm:w-16")}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">{title}</div>
        {subtitle && (
          <div className="text-sm font-bold text-[#1C8376] mt-1">
            {subtitle}
          </div>
        )}
      </div>
      {(footerLeft || footerRight) && (
        <div className="mt-3 flex items-center gap-3 text-[#1C8376]">
          {footerLeft && (
            <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
              {footerLeft}
            </div>
          )}
          {footerRight && (
            <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
              {footerRight}
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  if (to) {
    return (
      <Link to={to} className="no-underline block hover:bg-emerald-50/40 rounded-3xl">
        {inner}
      </Link>
    );
  }
  
  return inner;
}



