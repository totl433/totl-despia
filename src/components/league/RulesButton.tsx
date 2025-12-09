
export interface RulesButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * RulesButton - Reusable button for opening rules/modals
 * Used in Mini League Table and GW Results tabs
 */
export default function RulesButton({ onClick, className = "" }: RulesButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-full text-slate-600 hover:text-slate-800 cursor-help transition-colors flex-shrink-0 px-3 py-2 ${className}`}
    >
      <img 
        src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
        alt="Rules" 
        className="w-4 h-4"
        style={{ filter: 'invert(40%) sepia(8%) saturate(750%) hue-rotate(180deg) brightness(95%) contrast(88%)' }}
      />
      <span className="text-sm font-medium">Rules</span>
    </button>
  );
}

