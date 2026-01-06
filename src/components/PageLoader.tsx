/**
 * Branded page loader for lazy-loaded routes
 * Uses Volley animation for consistent loading experience
 */
export function PageLoader({ message }: { message?: string }) {
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
          {message || "Loading..."}
        </div>
      </div>
    </div>
  );
}


































