// Simple className utility
function cls(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type PickButtonProps = {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/**
 * Button for selecting Home/Draw/Away picks
 */
export default function PickButton({
  label,
  active,
  disabled,
  onClick,
}: PickButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cls(
        "h-16 rounded-xl border text-sm font-medium transition-colors",
        "flex items-center justify-center",
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}



