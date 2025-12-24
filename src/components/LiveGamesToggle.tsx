
export type LiveGamesToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  labels?: { on: string; off: string };
};

export default function LiveGamesToggle({ value, onChange, labels }: LiveGamesToggleProps) {
  const offLabel = labels?.off || 'ALL';
  const onLabel = labels?.on || 'LIVE';
  
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-medium transition-colors ${!value ? 'text-slate-700' : 'text-slate-400'}`}>
        {offLabel}
      </span>
      <button
        onClick={() => onChange(!value)}
        className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
        style={{
          backgroundColor: value ? '#dc2626' : '#cbd5e1',
          width: '48px',
          height: '24px',
          border: 'none'
        }}
        aria-label={value ? `Show ${offLabel}` : `Show ${onLabel}`}
      >
        <span 
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${value ? 'translate-x-6' : 'translate-x-0.5'}`}
        />
      </button>
      <span className={`text-[10px] font-medium transition-colors ${value ? 'text-slate-700' : 'text-slate-400'}`}>
        {onLabel}
      </span>
    </div>
  );
}


