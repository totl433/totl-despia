export interface ConfirmationModalProps {
 success: boolean;
 message: string;
 onClose?: () => void;
}

export default function ConfirmationModal({
 success,
 message,
 onClose,
}: ConfirmationModalProps) {
 return (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 px-10 py-8 text-center shadow-2xl max-w-sm mx-4">
 <div className="absolute -top-16 -left-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />
 <div className="absolute -bottom-14 -right-12 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />
 <div className="relative z-10 space-y-4">
 {success ? (
 <svg
 className="w-16 h-16 mx-auto text-emerald-600"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
 />
 </svg>) : (
 <svg
 className="w-16 h-16 mx-auto text-amber-600"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
 />
 </svg>)}
 <div
 className={`text-2xl font-extrabold ${
 success ?'text-emerald-700' :'text-amber-600'
 }`}
 >
 {success ?'Good Luck!' :'Not Quite Yet!'}
 </div>
 <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
 {onClose && (
 <button
 onClick={onClose}
 className="mt-4 px-6 py-2 bg-[#1C8376] text-white rounded-lg font-semibold"
 >
 Close
 </button>)}
 </div>
 </div>
 </div>);
}

