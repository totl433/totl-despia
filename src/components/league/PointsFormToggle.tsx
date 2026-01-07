
export interface PointsFormToggleProps {
 showForm: boolean;
 onToggle: (showForm: boolean) => void;
}

/**
 * PointsFormToggle - Toggle between Points and Form view in Mini League Table
 */
export default function PointsFormToggle({ showForm, onToggle }: PointsFormToggleProps) {
 return (
 <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 shadow-sm border border-slate-200 dark:border-slate-700">
 <button
 onClick={() => onToggle(false)}
   className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
   !showForm ?"bg-[#1C8376] text-white shadow-sm" :"text-slate-600 dark:text-slate-400"
   }`}
 >
 Points
 </button>
 <button
 onClick={() => onToggle(true)}
   className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
   showForm ?"bg-[#1C8376] text-white shadow-sm" :"text-slate-600 dark:text-slate-400"
   }`}
 >
 Form
 </button>
 </div>);
}

