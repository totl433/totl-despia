export interface SegmentedToggleProps {
  value: boolean;
  onToggle: (value: boolean) => void;
  labels: { left: string; right: string };
}

/**
 * SegmentedToggle - Generic segmented control toggle component
 * Used for toggling between two options (e.g., "All Players" / "Mini League Friends")
 */
export default function SegmentedToggle({ value, onToggle, labels }: SegmentedToggleProps) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-0.5 shadow-sm border border-slate-200">
      <button
        onClick={() => onToggle(false)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
          !value ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
        }`}
      >
        {labels.left}
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
          value ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
        }`}
      >
        {labels.right}
      </button>
    </div>
  );
}


