import React, { useRef, useEffect } from 'react';
import TeamBadge from './TeamBadge';
import type { Fixture, LiveScore } from './FixtureCard';
import { getMediumName } from '../lib/teamNames';
import { formatPercentage } from '../lib/formatPercentage';

export interface GameweekFixturesCardListForCaptureProps {
  gw: number;
  fixtures: Fixture[];
  picks?: Record<number, "H" | "D" | "A">;
  liveScores?: Map<number, LiveScore>;
  userName?: string;
  globalRank?: number;
  gwRankPercent?: number; // User's gameweek ranking as a percentage (e.g., 24 means top 24%)
  onCardRefReady?: (ref: React.RefObject<HTMLDivElement>) => void;
}

/**
 * EXACT visual replica of GameweekFixturesCardList for image capture
 * Uses html-to-image which handles flexbox perfectly, so we can use the original structure
 */
export default function GameweekFixturesCardListForCapture({
  gw,
  fixtures,
  picks = {},
  liveScores = new Map(),
  userName = 'Phil Bolton',
  globalRank,
  gwRankPercent,
  onCardRefReady,
}: GameweekFixturesCardListForCaptureProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const badgeSize = 24;

  // Debug logging
  useEffect(() => {
    console.log('[Capture] Component received props - gw:', gw, 'fixturesCount:', fixtures.length, 'picksCount:', Object.keys(picks).length);
    console.log('[Capture] gwRankPercent:', gwRankPercent, 'typeof:', typeof gwRankPercent, 'globalRank:', globalRank, 'userName:', userName);
    console.log('[Capture] willShowPercentPill:', gwRankPercent !== undefined, 'check:', gwRankPercent !== undefined);
    if (gwRankPercent === undefined) {
      console.warn('[Capture] WARNING: gwRankPercent is undefined - pill will NOT render');
    } else {
      console.log('[Capture] gwRankPercent has value - pill SHOULD render:', gwRankPercent);
    }
    console.log('[Capture] First fixture:', fixtures[0]);
    console.log('[Capture] All fixtures:', fixtures);
    console.log('[Capture] First pick:', Object.entries(picks)[0]);
    console.log('[Capture] All picks:', picks);
    console.log('[Capture] First live score:', Array.from(liveScores.entries())[0]);
    console.log('[Capture] All live scores:', Array.from(liveScores.entries()));
    console.log('[Capture] Sorted fixtures:', [...fixtures].sort((a, b) => a.fixture_index - b.fixture_index));
  }, [gw, fixtures, picks, liveScores, userName, globalRank, gwRankPercent]);

  // Preload Volley image to ensure it's available for capture - CRITICAL for reliable loading
  useEffect(() => {
    const volleyImg = new Image();
    volleyImg.src = '/assets/Volley/Volley-Leaning-With-Ball.png';
    // Set crossOrigin to allow CORS if needed
    volleyImg.crossOrigin = 'anonymous';
    volleyImg.onload = () => {
      console.log('[Capture] Volley image preloaded successfully, dimensions:', volleyImg.naturalWidth, 'x', volleyImg.naturalHeight);
    };
    volleyImg.onerror = (e) => {
      console.error('[Capture] Failed to preload Volley image:', volleyImg.src, e);
      // Retry once after a short delay
      setTimeout(() => {
        const retryImg = new Image();
        retryImg.src = volleyImg.src + '?_retry=' + Date.now();
        retryImg.onload = () => {
          console.log('[Capture] Volley image preloaded on retry');
        };
      }, 500);
    };
  }, []);

  useEffect(() => {
    if (onCardRefReady && cardRef.current) {
      onCardRefReady(cardRef);
    }
  }, [onCardRefReady, fixtures, picks, liveScores, userName, globalRank, gwRankPercent]);

  const sortedFixtures = [...fixtures].sort((a, b) => a.fixture_index - b.fixture_index);

  const calculateScore = () => {
    let score = 0;
    let liveCount = 0;
    let totalFixturesWithPicks = 0;
    let allFinished = true;
    let hasAnyActive = false;

    sortedFixtures.forEach((fixture) => {
      const pick = picks[fixture.fixture_index];
      const liveScore = liveScores.get(fixture.fixture_index);

      if (pick) {
        totalFixturesWithPicks++;
      }

      if (liveScore) {
        const isLive = liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED';
        const isFinished = liveScore.status === 'FINISHED';

        if (isLive || isFinished) {
          hasAnyActive = true;
          if (isLive) liveCount++;
          if (!isFinished) allFinished = false;

          if (pick) {
            let isCorrect = false;
            const result = (liveScore as any).result;
            if (result) {
              isCorrect = result === pick;
            } else {
              isCorrect =
                (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
                (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
                (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
            }
            if (isCorrect) score++;
          }
        } else {
          allFinished = false;
        }
      } else {
        allFinished = false;
      }
    });

    return { score, liveCount, allFinished, hasAnyActive, totalFixturesWithPicks };
  };

  const { score, liveCount, allFinished, hasAnyActive, totalFixturesWithPicks } = calculateScore();
  const displayUserName = userName.length > 18 ? userName.substring(0, 18) + '...' : userName;

  return (
    <>
      <style>{`
        .pulse-emerald-safe {
          opacity: 1 !important;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .team-name-small-mobile {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .username-responsive {
          font-size: 0.875rem;
        }
        @media (min-width: 360px) {
          .username-responsive {
            font-size: 1.125rem;
          }
        }
      `}</style>
      <div 
        ref={cardRef} 
        className="bg-white w-full max-w-[600px] mx-auto overflow-hidden"
        style={{ 
          width: '450px', 
          backgroundColor: 'white', 
          borderRadius: '0px', 
          boxShadow: 'none',
          aspectRatio: '2/3',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Green Header */}
        <div style={{ 
          backgroundColor: '#1C8376', 
          paddingTop: '10px', 
          paddingBottom: '10px',
          paddingLeft: '16px',
          paddingRight: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          minHeight: '95px'
        }}>
          <img 
            src="/assets/badges/totl-logo1.svg" 
            alt="TOTL" 
            style={{ 
              width: '75px', 
              height: '75px',
              filter: 'brightness(0) invert(1)',
              display: 'block',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            onError={() => {
              // If SVG fails, try to show a fallback or ensure it's visible
              console.error('[Capture] TOTL logo failed to load');
            }}
          />
          <img 
            src="/assets/Volley/Volley-Leaning-With-Ball.png" 
            alt="Volley" 
            loading="eager"
            crossOrigin="anonymous"
            decoding="sync"
            style={{ 
              width: '55px', 
              height: 'auto',
              display: 'block',
              transform: 'scaleX(-1)',
              position: 'absolute',
              left: '50%',
              marginLeft: '-80px',
              visibility: 'visible',
              opacity: 1,
              imageRendering: 'auto'
            }}
            onLoad={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              console.log('[Capture] Volley image loaded in DOM:', img.src, 'naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight, 'complete:', img.complete);
            }}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              console.error('[Capture] Volley image failed to load in DOM:', target.src);
              // Try reloading once with cache bust
              const baseSrc = target.src.split('?')[0];
              target.src = baseSrc + '?_retry=' + Date.now();
            }}
          />
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>

        {/* Header - EXACT match */}
        <div 
          className="mb-2 sm:mb-3 flex items-center justify-between flex-shrink-0 py-2 sm:py-3 px-1 sm:px-0"
          style={{ 
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            paddingTop: '8px',
            paddingBottom: '8px',
            paddingLeft: '4px',
            paddingRight: '0',
            position: 'relative',
            height: '48px'
          }}
        >
          {/* Score pill - left */}
          {hasAnyActive && (
            <div 
              className={`inline-flex items-center rounded-full text-white flex-shrink-0 ${allFinished ? 'bg-slate-600' : 'bg-red-600'}`}
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6.27px',
                paddingLeft: '14.63px',
                paddingRight: '12.54px',
                paddingTop: '6.27px',
                paddingBottom: '6.27px',
                borderRadius: '9999px',
                color: 'white',
                flexShrink: 0,
                backgroundColor: allFinished ? '#475569' : '#dc2626'
              }}
            >
              {!allFinished && liveCount > 0 && (
                <div 
                  className="bg-white rounded-full animate-pulse"
                  style={{ 
                    width: '8.36px', 
                    height: '8.36px', 
                    backgroundColor: 'white', 
                    borderRadius: '9999px',
                    opacity: 1
                  }}
                ></div>
              )}
              {allFinished && (
                <svg className="fill-none stroke-current" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '14.63px', height: '14.63px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              <span className="flex items-baseline" style={{ display: 'flex', alignItems: 'baseline', gap: '2.09px' }}>
                <span className="font-extrabold" style={{ fontSize: '18.81px', fontWeight: '800' }}>{score}</span>
                <span className="font-medium opacity-90" style={{ fontSize: '14.63px', fontWeight: '500', opacity: 0.9 }}>/</span>
                <span className="font-semibold opacity-80" style={{ fontSize: '16.72px', fontWeight: '600', opacity: 0.8 }}>{totalFixturesWithPicks}</span>
              </span>
            </div>
          )}
          {!hasAnyActive && <div></div>}
          {/* Name - centered */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ 
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1C8376', whiteSpace: 'nowrap', marginBottom: '2px' }}>Gameweek {gw}</div>
            <div className="username-responsive font-bold text-slate-700 truncate leading-tight" style={{ fontSize: '18px', fontWeight: '700', color: '#334155', lineHeight: '1.25', display: 'block' }}>{displayUserName}</div>
          </div>
          {/* GW Rank pill - right */}
          {gwRankPercent !== undefined && (() => {
            // Use formatPercentage utility to ensure consistent formatting
            // gwRankPercent is rank percentage: (rank / total) * 100
            // formatPercentage handles the conversion: >50 shows "Bottom X%", <=50 shows "Top X%"
            const formatted = formatPercentage(gwRankPercent);
            if (!formatted) return null;
            // Split the formatted text (e.g., "Bottom 39%" or "Top 5%") into label and percentage
            const parts = formatted.text.split(' ');
            const label = parts[0]; // "Bottom" or "Top"
            const percent = parts[1]; // "39%" or "5%"
            return (
              <div 
                className="inline-flex items-center rounded-full bg-slate-600 text-white flex-shrink-0"
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6.27px',
                  paddingLeft: '14.63px',
                  paddingRight: '12.54px',
                  paddingTop: '6.27px',
                  paddingBottom: '6.27px',
                  borderRadius: '9999px',
                  color: 'white',
                  flexShrink: 0,
                  backgroundColor: '#475569'
                }}
              >
                <span style={{ fontSize: '14.63px', fontWeight: '500', opacity: 0.9 }}>{label}</span>
                <span className="font-extrabold" style={{ fontSize: '18.81px', fontWeight: '800' }}>{percent}</span>
              </div>
            );
          })()}
        </div>

        {/* Fixtures list - EXACT same structure as original (html-to-image handles flexbox perfectly) */}
        <div className="flex-1 overflow-y-auto px-1 sm:px-0" style={{ flex: '1 1 0%', overflowY: 'auto', paddingLeft: '4px', paddingRight: '0' }}>
          {sortedFixtures.map((fixture, index) => {
            const pick = picks[fixture.fixture_index];
            const liveScore = liveScores.get(fixture.fixture_index);
            const hasLiveScore = !!liveScore;
            const isLive = hasLiveScore && liveScore.status === 'IN_PLAY';
            const isHalfTime = hasLiveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
            const isFinished = hasLiveScore && liveScore.status === 'FINISHED';
            const isOngoing = isLive || isHalfTime;
            const showScore = hasLiveScore && (isOngoing || isFinished);
            
            const homeIsWinning = isFinished && liveScore && liveScore.homeScore > liveScore.awayScore;
            const awayIsWinning = isFinished && liveScore && liveScore.awayScore > liveScore.homeScore;

            let pickCorrect: boolean | null = null;
            if (pick && liveScore) {
              const result = (liveScore as any).result;
              if (result) {
                pickCorrect = result === pick;
              } else {
                pickCorrect =
                  (pick === 'H' && liveScore.homeScore > liveScore.awayScore) ||
                  (pick === 'A' && liveScore.awayScore > liveScore.homeScore) ||
                  (pick === 'D' && liveScore.homeScore === liveScore.awayScore);
              }
            }

            const formatMinute = () => {
              if (isFinished && pick && pickCorrect !== null) {
                // For finished games with a pick, show tick or X
                return pickCorrect ? '✓' : '✗';
              }
              if (isFinished) return 'FT';
              if (isHalfTime) return 'HT';
              if (isLive && liveScore?.minute !== null && liveScore?.minute !== undefined) {
                return `${liveScore.minute}'`;
              }
              return '';
            };

            return (
              <div
                key={fixture.id || `${fixture.gw}-${fixture.fixture_index}`}
                className={`py-1 sm:py-2 relative ${index > 0 ? 'border-t border-slate-200' : ''}`}
                style={{ 
                  paddingTop: '8px', 
                  paddingBottom: '8px', 
                  position: 'relative',
                  borderTop: index > 0 ? '1px solid #e2e8f0' : 'none'
                }}
              >
                <div className="flex items-center justify-between" style={{ height: '32px' }}>
                  {/* FT/Time indicator - far left */}
                  <div className="flex-shrink-0" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', paddingRight: '8px', flexShrink: 0 }}>
                    {showScore ? (
                      isOngoing ? (
                        <div className="bg-red-500 rounded-full flex items-center justify-center animate-pulse" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', flexShrink: 0 }}>
                          <span className="text-[10px] font-semibold text-white leading-none">
                            {formatMinute()}
                          </span>
                        </div>
                      ) : (
                        <span 
                          className="font-black" 
                          style={{ 
                            fontSize: isFinished && pick && pickCorrect !== null ? '24px' : '10px',
                            fontWeight: '900',
                            whiteSpace: 'nowrap',
                            lineHeight: '1',
                            color: isFinished && pick && pickCorrect !== null ? (pickCorrect ? '#16a34a' : '#dc2626') : (isOngoing ? '#dc2626' : '#64748b'),
                            WebkitTextStroke: isFinished && pick && pickCorrect !== null ? (pickCorrect ? '1.5px' : '0.5px') : '0px',
                            WebkitTextStrokeColor: isFinished && pick && pickCorrect !== null ? (pickCorrect ? '#15803d' : '#991b1b') : 'transparent',
                          } as React.CSSProperties}
                        >
                          {formatMinute()}
                        </span>
                      )
                    ) : (
                      <span></span>
                    )}
                  </div>

                  {/* Home team - right aligned */}
                  <div className="flex-1 flex items-center justify-end gap-1.5 pr-0.5" style={{ height: '32px', minWidth: 0, maxWidth: '50%', flexShrink: 1, paddingLeft: '4px', gap: '6px', overflow: 'hidden' }}>
                    <span 
                      className={`team-name-small-mobile text-xs text-slate-700 ${homeIsWinning ? 'font-bold' : 'font-medium'}`}
                      style={{ 
                        fontSize: '14px', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap', 
                        maxWidth: '100%',
                        minWidth: 0,
                        flexShrink: 1,
                        display: 'block'
                      }}
                    >
                      {getMediumName(fixture.home_code || fixture.home_team || fixture.home_name || '')}
                    </span>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}>
                      <TeamBadge code={fixture.home_code} size={badgeSize} />
                    </div>
                  </div>

                  {/* Score or VS - centered between badges */}
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: '35px', height: '32px' }}>
                    {showScore ? (
                      <div className="flex items-center gap-1 leading-none">
                        <span className="text-sm font-bold text-slate-900 leading-none">
                          {liveScore!.homeScore}
                        </span>
                        <span className="text-sm font-bold text-slate-900 leading-none">-</span>
                        <span className="text-sm font-bold text-slate-900 leading-none">
                          {liveScore!.awayScore}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">vs</span>
                    )}
                  </div>

                  {/* Away team - left aligned */}
                  <div className="flex-1 flex items-center justify-start gap-1.5 pl-0.5" style={{ height: '32px', minWidth: 0, maxWidth: '50%', flexShrink: 1, gap: '6px', overflow: 'hidden' }}>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}>
                      <TeamBadge code={fixture.away_code} size={badgeSize} />
                    </div>
                    <span 
                      className={`team-name-small-mobile text-xs text-slate-700 ${awayIsWinning ? 'font-bold' : 'font-medium'}`}
                      style={{ 
                        fontSize: '14px', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap', 
                        maxWidth: '100%',
                        minWidth: 0,
                        flexShrink: 1,
                        display: 'block'
                      }}
                    >
                      {getMediumName(fixture.away_code || fixture.away_team || fixture.away_name || '')}
                    </span>
                  </div>

                  {/* Prediction pill - using absolute positioning for text to bypass flexbox issues */}
                  {pick && (
                    <div style={{ width: '80px', height: '32px', flexShrink: 0, marginLeft: '8px', position: 'relative' }}>
                      <span
                        className={`${pickCorrect === true && isFinished
                          ? 'bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white'
                          : pickCorrect === true && !isFinished
                          ? 'bg-emerald-600 text-white'
                          : pickCorrect === false && isFinished
                          ? 'bg-slate-400 text-white'
                          : 'bg-emerald-600 text-white'
                        }`}
                        style={{ 
                          display: 'block',
                          width: '80px',
                          height: '24px',
                          paddingTop: '0',
                          paddingBottom: '0',
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '800',
                          whiteSpace: 'nowrap',
                          color: 'white',
                          boxSizing: 'border-box',
                          position: 'absolute',
                          top: '4px',
                          left: '0',
                          textDecoration: pickCorrect === false && isFinished ? 'line-through' : 'none',
                          textDecorationThickness: '2px',
                          textDecorationColor: 'white',
                          lineHeight: '24px',
                          textAlign: 'center'
                        }}
                      >
                        {pick === 'H' ? 'Home Win' : pick === 'A' ? 'Away Win' : 'Draw'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {fixtures.length === 0 && (
          <div className="text-center py-8 text-slate-400" style={{ textAlign: 'center', paddingTop: '32px', paddingBottom: '32px', color: '#cbd5e1' }}>
            <p className="text-sm" style={{ fontSize: '14px' }}>No fixtures available</p>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
