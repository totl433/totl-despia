/**
 * Loading screen shown during auth actions
 * Uses the unicorn gif at 108px height
 */

// Import the gif from public assets
const LOADING_GIF = '/assets/Animation/Volley-Keepy-Uppies.gif';

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <img 
        src={LOADING_GIF} 
        alt="Loading..." 
        className="w-24 h-24 mb-4"
      />
      <p className="text-sm text-slate-500">Loading...</p>
    </div>
  );
}
