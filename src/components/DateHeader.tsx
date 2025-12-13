import { ReactNode } from 'react';

interface DateHeaderProps {
  date: string;
  className?: string;
  rightElement?: ReactNode;
}

export default function DateHeader({ date, className = "", rightElement }: DateHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-3 px-1 ${className}`}>
      <span className="text-sm font-semibold text-slate-700">{date}</span>
      {rightElement && <div>{rightElement}</div>}
    </div>
  );
}

