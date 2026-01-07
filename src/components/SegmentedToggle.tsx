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
 <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 shadow-sm border border-slate-200 dark:border-slate-700">
 <button
 onClick={() => onToggle(false)}
   className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
   !value ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 dark:text-slate-400"
   }`}
 >
 {labels.left}
 </button>
 <button
 onClick={() => onToggle(true)}
   className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
   value ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 dark:text-slate-400"
   }`}
 >
 {labels.right}
 </button>
 </div>
 );
}







