import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isWebBrowser } from '../lib/platform';
import { fireConfettiCannon } from '../lib/confettiCannon';
import { PageHeader } from '../components/PageHeader';
import SeasonPredictionsForm from '../components/seasonPredictions/SeasonPredictionsForm';
import SeasonPredictionsBoard from '../components/seasonPredictions/SeasonPredictionsBoard';
import SeasonPredictionsLobby from '../components/seasonPredictions/SeasonPredictionsLobby';
import SeasonPredictionsDeadline from '../components/seasonPredictions/SeasonPredictionsDeadline';
import {
  allPlayersSubmitted,
  emptySeasonPredictionPicks,
  isSeasonPredictionsDeadlinePassed,
  isSeasonPredictionsPlayer,
  isSeasonPredictionsResultsEditor,
  mockSeasonPredictionLobby,
  mockSeasonPredictionReveal,
  picksFromRow,
  picksToRow,
  playerStatusFromRows,
  scoreSeasonPredictions,
  SEASON_PREDICTION_PLAYER_NAMES,
  SEASON_PREDICTIONS_SEASON_KEY,
  validateSeasonPredictionPicks,
  type NamedSeasonPicks,
  type SeasonPredictionPicks,
  type SeasonPredictionPicksRow,
  type SeasonPredictionPlayerStatus,
} from '../lib/seasonPredictions';

type SaveMode = 'draft' | 'submit';

function picksHaveResults(picks: SeasonPredictionPicks): boolean {
  return validateSeasonPredictionPicks(picks).length === 0;
}

export default function SeasonPredictionsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [picks, setPicks] = useState<SeasonPredictionPicks>(emptySeasonPredictionPicks);
  const [results, setResults] = useState<SeasonPredictionPicks>(emptySeasonPredictionPicks);
  const [hasResultsRow, setHasResultsRow] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SeasonPredictionPlayerStatus[]>([]);
  const [entries, setEntries] = useState<NamedSeasonPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftJustSaved, setDraftJustSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const deadlinePassed = isSeasonPredictionsDeadlinePassed();
  const canPlay = isSeasonPredictionsPlayer(user?.id);
  const canEditResults = isSeasonPredictionsResultsEditor(user?.id);
  const previewMode = canEditResults ? searchParams.get('preview') : null;
  const previewLobby = previewMode === 'lobby';
  const previewReveal = previewMode === 'reveal' || previewMode === 'scored';
  const everyoneIn = allPlayersSubmitted(playerStatus);
  const showPicks = deadlinePassed || everyoneIn || previewReveal;
  const showLobby = (previewLobby || (!!submittedAt && !showPicks)) && !previewReveal;
  const locked = !!submittedAt || deadlinePassed;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !canPlay) {
      setLoading(false);
      return;
    }

    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const [
        { data: ownRow, error: ownError },
        { data: resultsRow, error: resultsError },
        { data: statusRows, error: statusError },
      ] = await Promise.all([
        supabase
          .from('season_prediction_picks')
          .select('*')
          .eq('season_key', SEASON_PREDICTIONS_SEASON_KEY)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('season_prediction_results')
          .select('*')
          .eq('season_key', SEASON_PREDICTIONS_SEASON_KEY)
          .maybeSingle(),
        supabase.rpc('season_prediction_player_status', {
          p_season_key: SEASON_PREDICTIONS_SEASON_KEY,
        }),
      ]);

      const tableMissing =
        ownError?.code === '42P01' ||
        resultsError?.code === '42P01' ||
        statusError?.code === 'PGRST202' ||
        /season_prediction_picks|schema cache|season_prediction_player_status/i.test(
          ownError?.message || resultsError?.message || statusError?.message || ''
        );
      if (tableMissing) {
        setMissingTable(true);
        return;
      }
      if (ownError) throw ownError;
      if (resultsError) throw resultsError;
      if (statusError) throw statusError;

      if (ownRow) {
        setPicks(picksFromRow(ownRow as SeasonPredictionPicksRow));
        setSubmittedAt(ownRow.submitted_at ?? null);
      } else {
        setPicks(emptySeasonPredictionPicks());
        setSubmittedAt(null);
      }

      if (resultsRow) {
        setResults(picksFromRow(resultsRow as SeasonPredictionPicksRow));
        setHasResultsRow(true);
      } else {
        setResults(emptySeasonPredictionPicks());
        setHasResultsRow(false);
      }

      const status = playerStatusFromRows(
        ((statusRows || []) as Array<{ user_id: string; submitted: boolean }>)
      );
      setPlayerStatus(status);

      const revealPicks = deadlinePassed || allPlayersSubmitted(status);
      if (revealPicks) {
        const { data: allRows, error: allError } = await supabase
          .from('season_prediction_picks')
          .select('*')
          .eq('season_key', SEASON_PREDICTIONS_SEASON_KEY)
          .not('submitted_at', 'is', null);
        if (allError) throw allError;

        setEntries(
          (allRows || []).map((row) => ({
            userId: row.user_id,
            name: SEASON_PREDICTION_PLAYER_NAMES[row.user_id] || 'Player',
            submitted: !!row.submitted_at,
            picks: picksFromRow(row as SeasonPredictionPicksRow),
          }))
        );
      } else {
        setEntries([]);
      }
    } catch (loadError) {
      console.error('[SeasonPredictions] Load error:', loadError);
      setError('Could not load Season Predictions. Try again.');
    } finally {
      setLoading(false);
    }
  }, [user, canPlay, deadlinePassed]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!error && !message) return;
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error, message]);

  useEffect(() => {
    if (!draftJustSaved) return;
    const timeout = window.setTimeout(() => setDraftJustSaved(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [draftJustSaved]);

  useEffect(() => {
    if (!submittedAt || showPicks || previewLobby) return;
    const interval = window.setInterval(() => {
      load({ silent: true });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [submittedAt, showPicks, previewLobby, load]);

  const mockReveal = useMemo(() => (previewReveal ? mockSeasonPredictionReveal() : null), [previewReveal]);
  const boardEntries = mockReveal?.entries ?? entries;
  const boardResults =
    previewMode === 'reveal'
      ? null
      : mockReveal?.results ?? (hasResultsRow && picksHaveResults(results) ? results : null);
  const scores = useMemo(
    () => scoreSeasonPredictions(boardEntries, boardResults),
    [boardEntries, boardResults]
  );
  const lobbyPlayers = previewLobby ? mockSeasonPredictionLobby() : playerStatus;

  async function savePicks(mode: SaveMode) {
    if (!user || locked) return;
    setError(null);
    setMessage(null);
    setDraftJustSaved(false);

    if (mode === 'submit') {
      const errors = validateSeasonPredictionPicks(picks);
      if (errors.length) {
        setError(errors[0]);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        season_key: SEASON_PREDICTIONS_SEASON_KEY,
        user_id: user.id,
        ...picksToRow(picks),
        submitted_at: mode === 'submit' ? new Date().toISOString() : null,
      };
      const { error: saveError } = await supabase
        .from('season_prediction_picks')
        .upsert(payload, { onConflict: 'season_key,user_id' });
      if (saveError) throw saveError;

      if (mode === 'submit') {
        setSubmittedAt(payload.submitted_at);
        fireConfettiCannon();
        await load({ silent: true });
      } else {
        setDraftJustSaved(true);
        setMessage('Draft saved. Submit when you’re happy — that locks it.');
      }
    } catch (saveError) {
      console.error('[SeasonPredictions] Save error:', saveError);
      setError(mode === 'submit' ? 'Could not submit. Check the deadline and try again.' : 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">Please sign in to view Season Predictions.</p>
      </Shell>
    );
  }

  if (!isWebBrowser()) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">
          Season Predictions is on the website only.{' '}
          <a className="text-[#1C8376] font-semibold" href="https://playtotl.com/season-predictions">
            Open playtotl.com/season-predictions
          </a>
        </p>
      </Shell>
    );
  }

  if (!canPlay) {
    return (
      <Shell>
        <p className="text-slate-600 dark:text-slate-300">This game is just for Prem Predictions.</p>
        <Link to="/profile" className="text-[#1C8376] font-semibold">Back to Profile</Link>
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
          {canEditResults
            ? 'Season Predictions is not live in the database yet. Apply supabase/sql/season_predictions.sql in the Supabase SQL editor, then refresh.'
            : 'Season Predictions is being set up. Try again shortly.'}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {showPicks ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {boardResults
            ? 'Official results are in. Points are on each pick.'
            : 'Everyone’s submitted picks. Scores arrive at the end of the season, once official results are entered.'}
        </p>
      ) : (
        <SeasonPredictionsDeadline
          variant={deadlinePassed ? 'passed' : submittedAt ? 'locked' : 'open'}
        />
      )}

      {previewLobby && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          Preview of the waiting room after submit. Made-up status.
        </div>
      )}

      {previewReveal && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          {previewMode === 'scored'
            ? 'Preview of the end-of-season scored view. Made-up picks and results.'
            : 'Preview of everyone’s picks, no scores yet. Made-up picks.'}
        </div>
      )}

      {deadlinePassed && !previewReveal && !previewLobby && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          {hasResultsRow && picksHaveResults(results)
            ? 'Scores are using the official results.'
            : 'Official results have not been entered yet.'}
        </div>
      )}

      {error && (showPicks || showLobby) && (
        <div
          ref={errorRef}
          className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {showLobby && <SeasonPredictionsLobby players={lobbyPlayers} />}

      {!showPicks && !showLobby && (
        <>
          <SeasonPredictionsForm picks={picks} locked={locked} onChange={setPicks} />

          {error && (
            <div
              ref={errorRef}
              className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-200"
            >
              {error}
            </div>
          )}
          {message && (
            <div
              ref={errorRef}
              className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-200"
            >
              {message}
            </div>
          )}

          {!locked && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => savePicks('draft')}
                disabled={saving}
                className={`flex-1 py-3 rounded-xl font-semibold ${
                  draftJustSaved
                    ? 'bg-[#1C8376] text-white'
                    : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                {saving ? 'Saving…' : draftJustSaved ? 'Saved' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => savePicks('submit')}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[#1C8376] text-white font-semibold"
              >
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}
        </>
      )}

      {showPicks && (
        <SeasonPredictionsBoard entries={boardEntries} results={boardResults} scores={scores} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <PageHeader title="Season Predictions" as="h1" />
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
