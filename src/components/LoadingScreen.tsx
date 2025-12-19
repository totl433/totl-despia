/**
 * Full-screen loading component shown while initial data is being loaded
 * Features the Volley mascot doing keepy-uppies
 */

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        {/* Volley mascot animation */}
        <div className="mb-4">
          <img 
            src="/assets/Animation/Volley-Keepy-Uppies.gif" 
            alt="Loading..." 
            className="w-24 h-24 mx-auto"
          />
        </div>
        
        {/* Loading text */}
        <div className="text-slate-500 text-sm">
          Fetching data
        </div>
      </div>
    </div>
  );
}





















