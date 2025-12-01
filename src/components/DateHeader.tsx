interface DateHeaderProps {
  date: string;
  className?: string;
}

export default function DateHeader({ date, className = "" }: DateHeaderProps) {
  return (
    <div className={`text-sm font-semibold text-slate-700 mb-3 px-1 ${className}`}>
      <span>{date}</span>
    </div>
  );
}

