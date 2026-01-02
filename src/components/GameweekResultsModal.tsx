import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { toPng } from 'html-to-image';
import ShareSheet from './ShareSheet';
import { fireConfettiCannon } from '../lib/confettiCannon';
import { getLeagueAvatarUrl, getDefaultMlAvatar } from '../lib/leagueAvatars';
import { formatPercentage } from '../lib/formatPercentage';
import { fetchGwResults, type GwResults } from '../lib/fetchGwResults';

// Helper function to get ordinal suffix
function getOrdinalSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
}

export interface GameweekResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gw: number;
  nextGw?: number | null; // Next GW if published
  mockResults?: GwResults | null; // For Storybook/testing - bypasses data fetching
  preloadedResults?: GwResults | null; // Pre-loaded results data (from app initialization)
  onLoadingChange?: (loading: boolean) => void; // Callback when loading state changes
}

// Re-export GwResults type for convenience
export type { GwResults };

export default function GameweekResultsModal({
  isOpen,
  onClose,
  gw,
  nextGw: _nextGw,
  mockResults,
  preloadedResults,
  onLoadingChange,
}: GameweekResultsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GwResults | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>('');

  // Fetch all data for this GW
  useEffect(() => {
    if (!isOpen || !gw) {
      setLoading(false);
      setResults(null);
      setError(null);
      onLoadingChange?.(false);
      return;
    }

    // Reset state when modal opens
    setResults(null);
    setError(null);

    // If preloadedResults provided, use them immediately (no loading needed)
    if (preloadedResults !== undefined && preloadedResults !== null) {
      setResults(preloadedResults);
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    // If mockResults provided, use them (for Storybook/testing)
    if (mockResults !== undefined && mockResults !== null) {
      // Ensure mlVictoryData exists (for backwards compatibility)
      const resultsWithDefaults = {
        ...mockResults,
        mlVictoryData: mockResults.mlVictoryData || mockResults.mlVictoryNames?.map((name, idx) => ({
          id: `mock-${idx}`,
          name,
          avatar: null,
        })) || [],
      };
      setResults(resultsWithDefaults);
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      onLoadingChange?.(false);
      return;
    }

    // TypeScript: user is guaranteed to be non-null after the check above
    const userId = user.id;

    let alive = true;

    async function fetchData() {
      setLoading(true);
      onLoadingChange?.(true);
      setError(null);

      try {
        const finalResults = await fetchGwResults(userId, gw);
        
        if (!alive) return;

        setResults(finalResults);
        setLoading(false);
        onLoadingChange?.(false);
      } catch (err: any) {
        if (alive) {
          setError(err?.message || 'Failed to load results');
          setLoading(false);
          onLoadingChange?.(false);
        }
      }
    }

    fetchData();

    return () => {
      alive = false;
    };
  }, [isOpen, user?.id, gw, mockResults, preloadedResults]);

  // Share functionality
  const handleShare = async () => {
    if (isSharing || !results) {
      return;
    }

    // Get user name
    const displayUserName = user?.user_metadata?.display_name || user?.email || 'User';
    
    // Set userName and showShareSheet
    setUserName(displayUserName);
    setShareImageUrl(null); // Show loading state
    setIsSharing(true);
    // Open ShareSheet immediately with loading state
    setShowShareSheet(true);
    
    // Small delay to ensure state is updated before rendering capture component
    await new Promise(resolve => setTimeout(resolve, 100));
    setShowCaptureModal(true);
    
    // Wait longer for modal to fully render and layout to settle
    await new Promise(resolve => setTimeout(resolve, 1500));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Wait for ref to be set (with timeout)
    let retries = 0;
    while (!shareCardRef.current && retries < 15) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    // Force multiple reflows to ensure layout is calculated
    if (shareCardRef.current) {
      void shareCardRef.current.offsetHeight;
      void shareCardRef.current.offsetWidth;
      await new Promise(resolve => requestAnimationFrame(resolve));
      void shareCardRef.current.offsetHeight;
    }

    try {
      if (!shareCardRef.current) {
        throw new Error('Capture element not found - ref was not set after retries');
      }
      
      const element = shareCardRef.current;
      
      // Wait for all images in the element to load
      const images = element.querySelectorAll('img');
      await Promise.all(Array.from(images).map((img: HTMLImageElement) => {
        const isVolleyImage = img.src.includes('Volley') || img.src.includes('volley');
        const timeout = isVolleyImage ? 5000 : 3000;
        
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null);
          }, timeout);
          img.onload = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null);
          };
        });
      }));
      
      // Additional wait to ensure everything is settled
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Hide any images that failed to load before capture
      Array.from(images).forEach((img: HTMLImageElement) => {
        if (!img.complete || img.naturalWidth === 0) {
          img.style.display = 'none';
          img.style.visibility = 'hidden';
          img.style.opacity = '0';
        }
      });
      
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.95,
        cacheBust: true,
        filter: (node) => {
          // Skip any images that are hidden or failed to load
          if (node instanceof HTMLImageElement) {
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return false;
            }
            if (!node.complete || node.naturalWidth === 0) {
              return false;
            }
          }
          return true;
        },
      });
      
      setShareImageUrl(dataUrl);
      setIsSharing(false);
      // Close capture modal after image is generated
      setShowCaptureModal(false);
    } catch (error) {
      setIsSharing(false);
      setShowCaptureModal(false);
    }
  };

  const handleCloseShareSheet = () => {
    setShowShareSheet(false);
    setIsSharing(false);
    setShowCaptureModal(false);
    setTimeout(() => {
      if (shareImageUrl) {
        URL.revokeObjectURL(shareImageUrl);
        setShareImageUrl(null);
      }
      // Close the modal after ShareSheet is closed
      onClose();
    }, 300);
  };

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fire confetti when card is loaded (not during loading)
  useEffect(() => {
    if (isOpen && !loading && results !== null) {
      // Fire confetti once the card is fully loaded - fun pop effect!
      setTimeout(() => {
        fireConfettiCannon();
      }, 300);
    }
  }, [isOpen, loading, results]);

  // Clean up loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      onLoadingChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Don't render modal content until data is ready
  // But allow ShareSheet to render even when modal is closed
  // Keep component mounted if ShareSheet is open, even if modal is closed
  if (!isOpen && !showShareSheet) return null;
  
  // Don't show modal until data is ready (no loading spinner in modal)
  if (loading || !results) {
    // Still allow ShareSheet to render if it's open
    if (showShareSheet) {
      return (
        <>
          {showShareSheet && (
            <div style={{ zIndex: 1000002 }}>
              <ShareSheet
                isOpen={showShareSheet}
                onClose={handleCloseShareSheet}
                imageUrl={shareImageUrl || ''}
                fileName={`gw${gw}-results.png`}
                gw={gw}
                userName={userName || user?.user_metadata?.display_name || user?.email || 'User'}
              />
            </div>
          )}
        </>
      );
    }
    
    // Don't render modal at all while loading - parent handles loading state
    return null;
  }

  const trophyCount = Object.values(results?.trophies || {}).filter(Boolean).length;

  const content = (
    <>
      {/* Backdrop - hide when ShareSheet is open */}
      {!showShareSheet && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
          style={{
            animation: 'fadeIn 200ms ease-out',
            zIndex: 999999,
          }}
        />
      )}

      {/* Modal - hide when ShareSheet is open */}
      {!showShareSheet && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gw-results-modal-title"
          style={{
            zIndex: 1000001, // Above confetti (1000000) and backdrop (999999)
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
        <div
          ref={cardRef}
          className="relative max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {error ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-red-500">{error}</div>
            </div>
          ) : results ? (
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
                  Gameweek {gw} Results
                </h2>
              </div>

              {/* Score */}
              <div className="relative mb-6">
                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-1">
                    <img
                      src="/assets/Volley/Volley-playing.png"
                      alt="Volley"
                      className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                    />
                    <div className="text-5xl sm:text-6xl font-bold text-emerald-600">
                      {results.score}/{results.totalFixtures}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trophies - only show if > 0 */}
              {trophyCount > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 rounded-xl shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
                  <div className="text-center mb-3 relative z-10">
                    <div className="text-lg font-bold text-white mb-2">Trophies Earned!</div>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {results.trophies.gw && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/Icons/Trophy--Streamline-Rounded-Material-Pro-Free.svg"
                            alt="GW Winner"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">GW Winner</span>
                        </div>
                      )}
                      {results.trophies.form5 && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/5-week-form-badge.png"
                            alt="5-Week Form"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">5-Week Form</span>
                        </div>
                      )}
                      {results.trophies.form10 && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/10-week-form-badge.png"
                            alt="10-Week Form"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">10-Week Form</span>
                        </div>
                      )}
                      {results.trophies.overall && (
                        <div className="flex flex-col items-center">
                          <img
                            src="/assets/season-rank-badge.png"
                            alt="Overall Leader"
                            className="w-12 h-12"
                          />
                          <span className="text-xs font-medium text-white mt-1">Overall Leader</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ML Victories */}
              {results.mlVictories > 0 && (
                <div className="mb-6">
                  <div className="text-center mb-3">
                    <div className="text-lg font-semibold text-slate-700">
                      Won {results.mlVictories} Mini-League{results.mlVictories !== 1 ? 's' : ''}!
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {(results.mlVictoryData || results.mlVictoryNames?.map((name, idx) => ({
                      id: `fallback-${idx}`,
                      name,
                      avatar: null,
                    })) || []).map((league) => {
                      const defaultAvatar = getDefaultMlAvatar(league.id);
                      const avatarUrl = getLeagueAvatarUrl(league);
                      return (
                        <div
                          key={league.id}
                          className="flex flex-col items-center bg-slate-50 rounded-lg p-2 min-w-[80px]"
                        >
                          <img
                            src={avatarUrl}
                            alt={`${league.name} avatar`}
                            className="w-12 h-12 rounded-full object-cover mb-1"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                              if (target.src !== fallbackSrc) {
                                target.src = fallbackSrc;
                              }
                            }}
                            onLoad={() => {}}
                          />
                          <div className="text-xs text-slate-600 text-center truncate max-w-[80px]">
                            {league.name.length > 8 ? `${league.name.substring(0, 8)}...` : league.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* GW Leaderboard - Prominent */}
            {results.gwRank !== null && results.gwRankTotal !== null && (() => {
              const rankPercent = (results.gwRank / results.gwRankTotal) * 100;
              const formatted = formatPercentage(rankPercent);
              return (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                  <div className="text-center">
                    <span className="text-slate-700 font-semibold text-xs mb-1 block">Gameweek {gw} Leaderboard</span>
                    <div className="flex items-end justify-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-800 font-bold text-3xl">
                          {results.gwRank}
                        </span>
                        <span className="text-slate-600 text-sm">{getOrdinalSuffix(results.gwRank)} of {results.gwRankTotal}</span>
                      </div>
                      {formatted && (
                        <span className={`text-2xl font-bold ${
                          formatted.isTop ? 'text-emerald-700' : 'text-orange-600'
                        }`}>
                          {formatted.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Other Leaderboard Stats - Compact */}
            {(results.leaderboardChanges.overall.after !== null || 
              results.leaderboardChanges.form5.after !== null || 
              results.leaderboardChanges.form10.after !== null) && (
              <div className="mb-4 p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  {results.leaderboardChanges.overall.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">Overall:</span>
                      {results.leaderboardChanges.overall.change !== null && results.leaderboardChanges.overall.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.overall.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.overall.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.overall.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.overall.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.overall.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form5.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">5W:</span>
                      {results.leaderboardChanges.form5.change !== null && results.leaderboardChanges.form5.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form5.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form5.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form5.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form5.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form5.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form10.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">10W:</span>
                      {results.leaderboardChanges.form10.change !== null && results.leaderboardChanges.form10.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form10.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form10.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form10.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form10.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form10.after}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSharing ? (
                    'Generating...'
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      SHARE
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 text-slate-600 font-bold"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* Temporary modal for capture - invisible but in viewport for html-to-image */}
      {showCaptureModal && results && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0,
            overflow: 'hidden',
          }}
        >
          <div
            ref={shareCardRef}
            style={{
              maxWidth: '512px',
              width: '100%',
            }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
          {/* Green Header */}
          <div style={{ 
            backgroundColor: '#1C8376', 
            paddingTop: '12px', 
            paddingBottom: '12px',
            paddingLeft: '16px',
            paddingRight: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            minHeight: '80px'
          }}>
            <img 
              src="/assets/badges/totl-logo1.svg" 
              alt="TOTL" 
              style={{ 
                width: '70px', 
                height: '70px',
                filter: 'brightness(0) invert(1)',
                display: 'block',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)'
              }}
              onError={() => {}}
            />
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
                Gameweek {gw} Results
              </h2>
            </div>

            {/* Score */}
            <div className="relative mb-6">
              <div className="text-center">
                <div className="mb-2 flex items-center justify-center gap-1">
                  <img
                    src="/assets/Volley/Volley-playing.png"
                    alt="Volley"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                  />
                  <div className="text-5xl sm:text-6xl font-bold text-emerald-600">
                    {results.score}/{results.totalFixtures}
                  </div>
                </div>
              </div>
            </div>

            {/* Trophies - only show if > 0 */}
            {trophyCount > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 rounded-xl shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
                <div className="text-center mb-3 relative z-10">
                  <div className="text-lg font-bold text-white mb-2">Trophies Earned!</div>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {results.trophies.gw && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/Icons/Trophy--Streamline-Rounded-Material-Pro-Free.svg"
                          alt="GW Winner"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">GW Winner</span>
                      </div>
                    )}
                    {results.trophies.form5 && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/5-week-form-badge.png"
                          alt="5-Week Form"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">5-Week Form</span>
                      </div>
                    )}
                    {results.trophies.form10 && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/10-week-form-badge.png"
                          alt="10-Week Form"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">10-Week Form</span>
                      </div>
                    )}
                    {results.trophies.overall && (
                      <div className="flex flex-col items-center">
                        <img
                          src="/assets/season-rank-badge.png"
                          alt="Overall Leader"
                          className="w-12 h-12"
                        />
                        <span className="text-xs font-medium text-white mt-1">Overall Leader</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ML Victories */}
            {results.mlVictories > 0 && (
              <div className="mb-6">
                <div className="text-center mb-3">
                  <div className="text-lg font-semibold text-slate-700">
                    Won {results.mlVictories} Mini-League{results.mlVictories !== 1 ? 's' : ''}!
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {(results.mlVictoryData || results.mlVictoryNames?.map((name, idx) => ({
                    id: `fallback-${idx}`,
                    name,
                    avatar: null,
                  })) || []).map((league) => {
                    const defaultAvatar = getDefaultMlAvatar(league.id);
                    const avatarUrl = getLeagueAvatarUrl(league);
                    return (
                      <div
                        key={league.id}
                        className="flex flex-col items-center bg-slate-50 rounded-lg p-2 min-w-[80px]"
                      >
                        <img
                          src={avatarUrl}
                          alt={`${league.name} avatar`}
                          className="w-12 h-12 rounded-full object-cover mb-1"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                            if (target.src !== fallbackSrc) {
                              target.src = fallbackSrc;
                            }
                          }}
                          onLoad={() => {}}
                        />
                        <div className="text-xs text-slate-600 text-center truncate max-w-[80px]">
                          {league.name.length > 8 ? `${league.name.substring(0, 8)}...` : league.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GW Leaderboard - Prominent */}
            {results.gwRank !== null && results.gwRankTotal !== null && (() => {
              const rankPercent = (results.gwRank / results.gwRankTotal) * 100;
              const formatted = formatPercentage(rankPercent);
              return (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                  <div className="text-center">
                    <span className="text-slate-700 font-semibold text-xs mb-1 block">Gameweek {gw} Leaderboard</span>
                    <div className="flex items-end justify-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-800 font-bold text-3xl">
                          {results.gwRank}
                        </span>
                        <span className="text-slate-600 text-sm">{getOrdinalSuffix(results.gwRank)} of {results.gwRankTotal}</span>
                      </div>
                      {formatted && (
                        <span className={`text-2xl font-bold ${
                          formatted.isTop ? 'text-emerald-700' : 'text-orange-600'
                        }`}>
                          {formatted.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Other Leaderboard Stats - Compact */}
            {(results.leaderboardChanges.overall.after !== null || 
              results.leaderboardChanges.form5.after !== null || 
              results.leaderboardChanges.form10.after !== null) && (
              <div className="mb-4 p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  {results.leaderboardChanges.overall.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">Overall:</span>
                      {results.leaderboardChanges.overall.change !== null && results.leaderboardChanges.overall.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.overall.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.overall.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.overall.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.overall.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.overall.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form5.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">5W:</span>
                      {results.leaderboardChanges.form5.change !== null && results.leaderboardChanges.form5.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form5.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form5.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form5.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form5.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form5.after}</span>
                      )}
                    </div>
                  )}
                  {results.leaderboardChanges.form10.after !== null && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-xs">10W:</span>
                      {results.leaderboardChanges.form10.change !== null && results.leaderboardChanges.form10.change !== 0 ? (
                        <span className={`font-bold text-xs flex items-center gap-0.5 ${
                          results.leaderboardChanges.form10.change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {results.leaderboardChanges.form10.change > 0 ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 4l-8 8h16l-8-8z" />
                              </svg>
                              <span>{results.leaderboardChanges.form10.change}</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true">
                                <path d="M12 20l8-8H4l8 8z" />
                              </svg>
                              <span>{Math.abs(results.leaderboardChanges.form10.change)}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-800 font-bold text-xs">#{results.leaderboardChanges.form10.after}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          </div>
        </div>
      )}

      {/* Share Sheet - render outside modal */}
      {showShareSheet && (
        <div style={{ zIndex: 1000002 }}>
          <ShareSheet
            isOpen={showShareSheet}
            onClose={handleCloseShareSheet}
            imageUrl={shareImageUrl || ''}
            fileName={`gw${gw}-results.png`}
            gw={gw}
            userName={userName || user?.user_metadata?.display_name || user?.email || 'User'}
          />
        </div>
      )}
    </>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}

