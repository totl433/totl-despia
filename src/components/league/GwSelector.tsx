
export interface GwSelectorProps {
  availableGws: number[];
  selectedGw: number | null;
  onChange: (gw: number) => void;
  className?: string;
}

/**
 * GwSelector - Dropdown for selecting a gameweek
 * Used in GW Results tab
 */
export default function GwSelector({ 
  availableGws, 
  selectedGw, 
  onChange,
  className = ""
}: GwSelectorProps) {
  if (availableGws.length <= 1) {
    return null;
  }

  return (
    <div className={`flex-1 ${className}`}>
      <select
        value={selectedGw || undefined}
        onChange={(e) => {
          const newGw = parseInt(e.target.value, 10);
          onChange(newGw);
        }}
        className="gw-selector w-full bg-white rounded-full border-2 border-slate-300 px-3 py-2 text-xs font-normal text-slate-600 text-center focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-[#1C8376] active:bg-slate-50 transition-colors"
        style={{
          minHeight: '40px',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1em 1em',
          paddingRight: '2.5rem'
        }}
      >
        {availableGws.map((gw) => (
          <option key={gw} value={gw} className="text-xs" style={{ padding: '0.5rem', fontWeight: 'normal', color: '#64748b' }}>
            Gameweek {gw}
          </option>
        ))}
      </select>
    </div>
  );
}

