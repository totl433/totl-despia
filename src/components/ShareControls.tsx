
import { useState } from"react";

/**
 * Small, self-contained copy/share control with a toast.
 * Usage: <ShareControls name={league.name} code={league.code} url={`/league/${league.code}`} />
 */
export default function ShareControls({
 name,
 code,
 url,
 compact = false,
}: {
 name: string;
 code: string;
 url: string; // path or absolute
 compact?: boolean;
}) {
 const [toast, setToast] = useState("");

 function show(msg: string) {
 setToast(msg);
 window.clearTimeout((show as any)._t);
 (show as any)._t = window.setTimeout(() => setToast(""), 1600);
 }

 async function copyCode() {
 try {
 await navigator.clipboard.writeText(code);
 show("Code copied");
 } catch {
 show("Couldn’t copy");
 }
 }

 async function share() {
 const abs = url.startsWith("http") ? url : `${location.origin}${url}`;
 const text = `Join my TOTL league"${name}" — code ${code}`;
 try {
 // Prefer the Web Share API if available
 if ((navigator as any).share) {
 await (navigator as any).share({ title:"TOTL league", text, url: abs });
 return;
 }
 // Fallback: copy composed text
 await navigator.clipboard.writeText(`${text}\n${abs}`);
 show("Share text copied");
 } catch {
 show("Couldn’t share");
 }
 }

 return (
 <div className={`flex items-center gap-2 ${compact ?"" :"mt-2"}`}>
 <button
 type="button"
 onClick={copyCode}
     className="px-2 py-1 rounded border text-sm"
     title="Copy code"
 >
 Copy code
 </button>
 <button
 type="button"
 onClick={share}
     className="px-2 py-1 rounded border text-sm"
     title="Share"
 >
 Share
 </button>

 {/* mini toast */}
 <div
 className={`ml-2 text-xs rounded bg-slate-900 text-white px-2 py-1 ${
 toast ?"opacity-100" :"opacity-0 pointer-events-none"
 }`}
 >
 {toast ||"…"}
 </div>
 </div>);
}