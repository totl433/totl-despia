import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isWebBrowser } from '../lib/platform';
import { PageHeader } from '../components/PageHeader';
import SeasonPredictionsForm from '../components/seasonPredictions/SeasonPredictionsForm';
import {
  emptySeasonPredictionPicks,
  isSeasonPredictionsResultsEditor,
  picksFromRow,
  picksToRow,
  SEASON_PREDICTIONS_SEASON_KEY,
  validateSeasonPredictionPicks,
  type SeasonPredictionPicks,
  type SeasonPredictionPicksRow,
} from '../lib/seasonPredictions';

export default function SeasonPredictionsResultsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<SeasonPredictionPicks>(emptySeasonPredictionPicks);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  const canEdit = isSeasonPredictionsResultsEditor(user?.id);

  const load = useCallback(async () => {
    if (!user || !canEdit) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await supabase
        .from('season_prediction_results')
        .select('*')
        .eq('season_key', SEASON_PREDICTIONS_SEASON_KEY)
        .maybeSingle();

      if (loadError?.code === '42P01' || /season_prediction_results|schema cache/i.test(loadError?.message || '')) {
        setMissingTable(true);
        return;
      }
      if (loadError) throw loadError;

      setResults(data ? picksFromRow(data as SeasonPredictionPicksRow) : emptySeasonPredictionPicks());
    } catch (loadError) {
      console.error('[SeasonPredictionsResults] Load error:', loadError);
      setError('Could not load official results. Try again.');
    } finally {
      setLoading(false);
    }
  }, [user, canEdit]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveResults() {
    if (!user || !canEdit) return;
    const errors = validateSeasonPredictionPicks(results);
    if (errors.length) {
      setError(errors[0]);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: saveError } = await supabase.from('season_prediction_results').upsert({
        season_key: SEASON_PREDICTIONS_SEASON_KEY,
        ...picksToRow(results),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      setMessage('Official results saved. Scores will show on Season Predictions.');
    } catch (saveError) {
      console.error('[SeasonPredictionsResults] Save error:', saveError);
      setError('Could not save official results.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">Please sign in to enter official results.</p>
      </Shell>
    );
  }

  if (!isWebBrowser()) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">
          Season Predictions is on the website only.{' '}
          <a className="text-[#1C8376] font-semibold" href="https://playtotl.com/season-predictions/results">
            Open playtotl.com/season-predictions/results
          </a>
        </p>
      </Shell>
    );
  }

  if (!canEdit) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">Only Jof can enter official results.</p>
        <Link to="/season-predictions" className="text-[#1C8376] font-semibold">Back to Season Predictions</Link>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-slate-500">Loading…</p>
      </Shell>
    );
  }

  if (missingTable) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">
          Season Predictions is not live in the database yet. Apply supabase/sql/season_predictions.sql in the Supabase SQL editor, then refresh.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Enter the real 2026/27 outcomes at the end of the season. Scoring on Season Predictions uses these as soon as they are saved.
      </p>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200">
          {message}
        </div>
      )}

      <SeasonPredictionsForm picks={results} locked={false} onChange={setResults} showScoringHints={false} />

      <button
        type="button"
        onClick={saveResults}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
      >
        {saving ? 'Saving results…' : 'Save official results'}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <PageHeader title="Season Predictions results" as="h1" />
          <Link to="/admin-data" className="text-slate-600 dark:text-slate-300" aria-label="Back">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
