/**
 * Full-screen loading component shown while initial data is being loaded
 */

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Spinner */}
        <div className="mb-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#1C8376] mx-auto"></div>
        </div>
        
        {/* Loading text */}
        <div className="text-slate-700">
          <div className="text-2xl font-bold mb-2">Loading TOTL...</div>
          <div className="text-sm text-slate-500">Fetching your data</div>
        </div>
      </div>
    </div>
  );
}















