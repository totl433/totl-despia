
export interface FormDisplayProps {
  form: ("W" | "D" | "L")[];
}

/**
 * FormDisplay - Displays the last 5 gameweek results as W/D/L indicators
 * Used in Mini League Table when Form view is selected
 */
export default function FormDisplay({ form }: FormDisplayProps) {
  const last5 = form.slice(-5);
  const pad = 5 - last5.length;

  return (
    <div className="flex items-center justify-between w-full">
      {Array.from({ length: pad }).map((_, i) => (
        <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
      ))}
      {last5.map((result, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
            result === "W"
              ? "bg-green-100 text-green-700"
              : result === "D"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {result}
        </div>
      ))}
    </div>
  );
}

