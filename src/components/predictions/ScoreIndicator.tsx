import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import ShareSheet from '../ShareSheet';
import GameweekFixturesCardListForCapture from '../GameweekFixturesCardListForCapture';
import { formatPercentage } from '../../lib/formatPercentage';

export interface ScoreIndicatorProps {
  score: number;
  total: number;
  topPercent?: number | null;
  state?: 'starting-soon' | 'live' | 'finished';
  gameweek?: number | null;
  gameStateLoading?: boolean;
}

export default function ScoreIndicator({
  score,
  total,
  topPercent,
  state = 'finished',
  gameweek,
  gameStateLoading = false,
}: ScoreIndicatorProps) {
  const { user } = useAuth();
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [shareFixtures, setShareFixtures] = useState<any[]>([]);
  const [sharePicks, setSharePicks] = useState<Record<number, "H" | "D" | "A">>({});
  const [shareLiveScores, setShareLiveScores] = useState<Map<number, any>>(new Map());
  const [userName, setUserName] = useState<string>('');

  const percentage = total > 0 ? (score / total) * 100 : 0;

  // Determine live indicator based on state
  const showLiveIndicator = !gameStateLoading && state === 'live';

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSharing) return;
    if (!gameweek || !user?.id) return;
    
    console.log('[ScoreIndicator] handleShare called, topPercent:', topPercent);
    
    // Get user name immediately
    const displayUserName = user?.user_metadata?.display_name || user?.email || 'User';
    setUserName(displayUserName);
    
    // Show ShareSheet immediately with loading state
    setIsSharing(true);
    setShowShareSheet(true);
    setShareImageUrl(null); // Ensure it starts as null to show loading
    setShowCaptureModal(true);
    
    try {
      // Fetch fixtures for the gameweek
      const { data: fixturesData } = await supabase
        .from('app_fixtures')
        .select('*')
        .eq('gw', gameweek)
        .order('fixture_index', { ascending: true });
      
      if (!fixturesData || fixturesData.length === 0) {
        throw new Error('No fixtures found for this gameweek');
      }
      
      // Format fixtures exactly like shareableFixtures in GamesSection
      const shareableFixtures = fixturesData.map(f => ({
        id: f.id,
        gw: f.gw,
        fixture_index: f.fixture_index,
        home_code: f.home_code ?? undefined,
        away_code: f.away_code ?? undefined,
        home_team: f.home_team ?? undefined,
        away_team: f.away_team ?? undefined,
        home_name: f.home_name ?? undefined,
        away_name: f.away_name ?? undefined,
        kickoff_time: f.kickoff_time ?? undefined,
        api_match_id: f.api_match_id ?? undefined,
      }));
      setShareFixtures(shareableFixtures);
      
      // Fetch picks
      const { data: picksData } = await supabase
        .from('app_picks')
        .select('fixture_index, pick')
        .eq('gw', gameweek)
        .eq('user_id', user.id);
      
      const picksMap: Record<number, "H" | "D" | "A"> = {};
      (picksData || []).forEach((p: any) => {
        picksMap[p.fixture_index] = p.pick;
      });
      setSharePicks(picksMap);
      
      // Fetch live scores and convert to Record format first (like GamesSection)
      const apiMatchIds = shareableFixtures
        .map(f => f.api_match_id)
        .filter((id): id is number => id !== null && id !== undefined);
      
      const liveScoresRecord: Record<number, any> = {};
      if (apiMatchIds.length > 0) {
        const { data: liveScoresData } = await supabase
          .from('live_scores')
          .select('*')
          .in('api_match_id', apiMatchIds);
        
        (liveScoresData || []).forEach((score: any) => {
          const fixture = shareableFixtures.find(f => f.api_match_id === score.api_match_id);
          if (fixture) {
            liveScoresRecord[fixture.fixture_index] = {
              homeScore: score.home_score ?? 0,
              awayScore: score.away_score ?? 0,
              status: score.status || 'SCHEDULED',
              minute: score.minute ?? null,
              goals: score.goals ?? null,
              red_cards: score.red_cards ?? null,
              home_team: score.home_team ?? null,
              away_team: score.away_team ?? null,
              result: score.result ?? undefined,
            };
          }
        });
      }
      
      // Convert to Map exactly like GamesSection
      const liveScoresMap = new Map<number, any>();
      Object.entries(liveScoresRecord).forEach(([fixtureIndexStr, score]) => {
        const fixtureIndex = parseInt(fixtureIndexStr, 10);
        liveScoresMap.set(fixtureIndex, {
          status: score.status as any,
          minute: score.minute ?? null,
          homeScore: score.homeScore,
          awayScore: score.awayScore,
          home_team: score.home_team ?? null,
          away_team: score.away_team ?? null,
          goals: score.goals?.map((g: any) => ({
            team: g.team || '',
            scorer: g.scorer || '',
            minute: g.minute ?? null,
          })) ?? undefined,
          red_cards: score.red_cards?.map((r: any) => ({
            team: r.team || '',
            player: r.player || '',
            minute: r.minute ?? null,
          })) ?? undefined,
          result: score.result ?? undefined,
        });
      });
      setShareLiveScores(liveScoresMap);
      
      // Wait for modal to render - exactly like GamesSection
      await new Promise(resolve => setTimeout(resolve, 1500));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Wait for ref
      let retries = 0;
      while (!captureRef.current && retries < 15) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (!captureRef.current) {
        throw new Error('Capture element not found');
      }
      
      // Force reflows
      const element = captureRef.current;
      void element.offsetHeight;
      void element.offsetWidth;
      await new Promise(resolve => requestAnimationFrame(resolve));
      void element.offsetHeight;
      
      // Check if images are already loaded (they should be since we preload)
      const images = element.querySelectorAll('img');
      const unloadedImages = Array.from(images).filter((img: HTMLImageElement) => 
        !img.complete || img.naturalWidth === 0
      );
      
      if (unloadedImages.length > 0) {
        console.log('[Share] Waiting for', unloadedImages.length, 'images to load');
        // Wait for images to load - give Volley images extra time since they're critical
        await Promise.all(unloadedImages.map((img: HTMLImageElement) => {
          const isVolley = img.src.includes('Volley');
          const timeout = isVolley ? 5000 : 2000; // Give Volley 5 seconds, others 2 seconds
          console.log('[Share] Waiting for image:', img.src, 'timeout:', timeout + 'ms');
          return new Promise((resolve) => {
            // If already loaded, resolve immediately
            if (img.complete && img.naturalWidth > 0) {
              if (isVolley) {
                console.log('[Share] Volley image already loaded:', img.naturalWidth, 'x', img.naturalHeight);
              }
              resolve(null);
              return;
            }
            const timeoutId = setTimeout(() => {
              console.warn('[Share] Image load timeout after', timeout + 'ms:', img.src);
              resolve(null);
            }, timeout);
            img.onload = () => { 
              clearTimeout(timeoutId); 
              if (isVolley) {
                console.log('[Share] Volley image loaded:', img.naturalWidth, 'x', img.naturalHeight);
              }
              resolve(null); 
            };
            img.onerror = () => { 
              clearTimeout(timeoutId); 
              console.error('[Share] Image load error:', img.src);
              resolve(null); 
            };
            // Force reload if it failed
            if (img.src) {
              img.src = img.src + (img.src.includes('?') ? '&' : '?') + '_t=' + Date.now();
            }
          });
        }));
      } else {
        console.log('[Share] All images already loaded, proceeding immediately');
      }
      
      // Small delay to ensure DOM is fully rendered
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Capture image - exactly like GamesSection
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.95,
        cacheBust: true,
        filter: (node) => {
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
      
      if (!dataUrl || dataUrl.length === 0) {
        throw new Error('Image capture returned empty data');
      }
      
      // Create final canvas - exactly like GamesSection
      const img = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Image load timeout after 5 seconds')), 5000);
        img.onload = () => { clearTimeout(timeout); resolve(null); };
        img.onerror = () => { clearTimeout(timeout); reject(new Error('Failed to load captured image data')); };
        img.src = dataUrl;
      });
      
      const targetWidth = 1500;
      const targetHeight = 2250;
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas 2D context');
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      
      const scaleX = targetWidth / img.width;
      const scaleY = targetHeight / img.height;
      const imageScale = Math.min(scaleX, scaleY);
      const scaledWidth = img.width * imageScale;
      const scaledHeight = img.height * imageScale;
      const imageX = (targetWidth - scaledWidth) / 2;
      const imageY = (targetHeight - scaledHeight) / 2;
      
      ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);
      
      setShowCaptureModal(false);
      const finalImageUrl = finalCanvas.toDataURL('image/png', 0.95);
      setShareImageUrl(finalImageUrl);
      setIsSharing(false);
    } catch (error: any) {
      console.error('[ScoreIndicator] Error generating share image:', error);
      const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
      alert(`Failed to generate image: ${errorMessage}`);
      setShowShareSheet(false);
      setShowCaptureModal(false);
      setIsSharing(false);
    }
  };
  
  const handleCloseShareSheet = () => {
    setShowShareSheet(false);
    setTimeout(() => {
      if (shareImageUrl) {
        URL.revokeObjectURL(shareImageUrl);
        setShareImageUrl(null);
      }
    }, 300);
  };

  // Determine if share button should be shown - more explicit check
  const shouldShowShare = gameweek != null && gameweek > 0 && user?.id != null;
  
  // Debug logging to help diagnose live site issues (always log in dev, conditionally in prod for debugging)
  if (typeof window !== 'undefined') {
    const isDev = import.meta.env.DEV;
    if (isDev || (!shouldShowShare && gameweek != null)) {
      console.log('[ScoreIndicator] Share button visibility:', {
        shouldShowShare,
        gameweek,
        userId: user?.id,
        hasUser: !!user,
      });
    }
  }

  return (
    <>
      <div className="mb-4 rounded-xl border bg-gradient-to-br from-[#1C8376]/5 to-blue-50/50 shadow-sm px-6 py-5">
        <div className="text-center">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {shouldShowShare && (
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="p-1 hover:bg-slate-100 rounded transition-colors inline-flex items-center justify-center"
                  aria-label="Share gameweek score"
                  title="Share"
                >
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              )}
              <div className="text-4xl font-extrabold text-[#1C8376]">{score}/{total}</div>
            </div>
            <div className="flex items-center gap-3">
              {topPercent !== null && topPercent !== undefined && (() => {
                const formatted = formatPercentage(topPercent);
                return (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300">
                    <span className="text-sm font-bold text-orange-700">{formatted?.text || `Top ${topPercent}%`}</span>
                  </div>
                );
              })()}
              {showLiveIndicator && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-red-600">Live</span>
                </div>
              )}
            </div>
          </div>
          <div className="mb-3 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1C8376] to-blue-500 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Capture modal for share image generation - exactly like LeaderboardCard */}
      {showCaptureModal && userName && (
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
            style={{
              maxWidth: '672px',
              width: '100%',
            }}
            className="image-capture-mode"
          >
            <style>{`
              .image-capture-mode .truncate {
                text-overflow: clip !important;
                overflow: visible !important;
                white-space: normal !important;
                max-width: none !important;
              }
              .image-capture-mode .team-name-small-mobile {
                text-overflow: clip !important;
                overflow: visible !important;
                white-space: normal !important;
                max-width: none !important;
                flex-shrink: 0 !important;
              }
              .image-capture-mode .flex-1 {
                min-width: 0 !important;
              }
            `}</style>
            <GameweekFixturesCardListForCapture
              gw={gameweek!}
              fixtures={shareFixtures}
              picks={sharePicks}
              liveScores={shareLiveScores}
              userName={userName}
              globalRank={topPercent ? Math.round((topPercent / 100) * total) : undefined}
              gwRankPercent={(() => {
                const value = topPercent !== null && topPercent !== undefined ? topPercent : undefined;
                console.log('[ScoreIndicator] Passing gwRankPercent to capture component:', value, 'topPercent was:', topPercent);
                return value;
              })()}
              onCardRefReady={(ref) => {
                // Store the ref element directly
                if (ref?.current) {
                  captureRef.current = ref.current;
                  console.log('[ScoreIndicator] Capture ref ready, topPercent:', topPercent, 'gwRankPercent:', topPercent !== null && topPercent !== undefined ? topPercent : undefined);
                  // Force Volley image to load before capture
                  const volleyImg = ref.current.querySelector('img[src*="Volley"]') as HTMLImageElement;
                  if (volleyImg) {
                    console.log('[ScoreIndicator] Found Volley image in DOM:', volleyImg.src, 'complete:', volleyImg.complete, 'naturalWidth:', volleyImg.naturalWidth);
                    if (!volleyImg.complete || volleyImg.naturalWidth === 0) {
                      // Force reload with cache bust
                      const currentSrc = volleyImg.src.split('?')[0];
                      volleyImg.src = currentSrc + '?_t=' + Date.now();
                      console.log('[ScoreIndicator] Forcing Volley image reload:', volleyImg.src);
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}
      
      {/* Share Sheet - show immediately with loading state */}
      {showShareSheet && userName && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={handleCloseShareSheet}
          imageUrl={shareImageUrl || ''}
          fileName={`${userName}'s Predictions Totl Gameweek ${gameweek}.png`}
          gw={gameweek!}
          userName={userName}
        />
      )}
    </>
  );
}

