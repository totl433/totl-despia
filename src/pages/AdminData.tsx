import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isWebBrowser } from '../lib/platform';
import { isSeasonPredictionsPlayer, isSeasonPredictionsResultsEditor } from '../lib/seasonPredictions';

export default function AdminDataPage() {
  const { user } = useAuth();
  const isAdmin =
    user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' ||
    user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';
  const canOpenSeasonPredictions = isSeasonPredictionsPlayer(user?.id) && isWebBrowser();
  const canOpenSeasonPredictionsResults = isSeasonPredictionsResultsEditor(user?.id) && isWebBrowser();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 mb-4">Please sign in to view admin data.</div>
          <Link to="/profile" className="text-[#1C8376]">Go to Profile</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin && !canOpenSeasonPredictions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 mb-4">Access denied. Admin only.</div>
          <Link to="/profile" className="text-[#1C8376]">Go to Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold text-slate-800">Admin</h1>
            <Link to="/profile" className="text-slate-600" aria-label="Back to profile">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            We can add tools back here if we need them.
          </p>
          <div className="space-y-3">
            {isAdmin && (
              <Link
                to="/api-admin"
                className="block w-full py-3 bg-[#1C8376] text-white font-semibold rounded-xl text-center"
              >
                Create New Gameweek
              </Link>
            )}
            {isAdmin && isWebBrowser() && (
              <Link
                to="/admin/gw-stats"
                className="block w-full py-3 bg-white border-2 border-[#1C8376] text-[#1C8376] font-semibold rounded-xl text-center"
              >
                GW Stats
              </Link>
            )}
            {canOpenSeasonPredictions && (
              <Link
                to="/season-predictions"
                className="block w-full py-3 bg-white border-2 border-[#1C8376] text-[#1C8376] font-semibold rounded-xl text-center"
              >
                Season Predictions
              </Link>
            )}
            {canOpenSeasonPredictionsResults && (
              <Link
                to="/season-predictions/results"
                className="block w-full py-3 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-center"
              >
                Season Predictions results
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
