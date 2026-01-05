import React from 'react';

export interface NotificationToggleProps {
 id: string;
 label: string;
 description?: string;
 enabled: boolean;
 onChange: (enabled: boolean) => void;
 disabled?: boolean;
}

export const NotificationToggle = React.memo(function NotificationToggle({
 id,
 label,
 description,
 enabled,
 onChange,
 disabled = false,
}: NotificationToggleProps) {
 return (
 <div className="group flex items-start gap-4 py-4 border-b border-slate-200 last:border-b-0 -mx-2 px-2 rounded">
 <div className="flex-1 min-w-0">
 <label
 htmlFor={id}
 className="block text-base font-medium text-slate-800 cursor-pointer"
 >
 {label}
 </label>
 {description && (
 <p className="mt-1 text-sm text-slate-600">{description}</p>
 )}
 </div>
 <div className="flex-shrink-0 pt-0.5">
 <label className="relative inline-flex items-center cursor-pointer" htmlFor={id}>
 <input
 type="checkbox"
 id={id}
 checked={enabled}
 onChange={(e) => onChange(e.target.checked)}
 disabled={disabled}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1C8376]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1C8376] peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
 </label>
 </div>
 </div>
 );
});

