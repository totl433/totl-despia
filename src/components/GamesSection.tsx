import { useMemo, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import Section from './Section';
import { type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from './FixtureCard';
import DateGroupedFixtures from './DateGroupedFixtures';
import GameweekFixturesCardListForCapture from './GameweekFixturesCardListForCapture';
import ShareSheet from './ShareSheet';
import type { Fixture, LiveScore } from './FixtureCard';
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface GamesSectionProps {
  isInApiTestLeague: boolean;
  fixtures: Array<{ id: string; gw: number; fixture_index: number; test_gw?: number | null; [key: string]: any }>;
  fixtureCards: Array<{ fixture: FixtureCardFixture; liveScore: FixtureCardLiveScore | null; pick: "H" | "D" | "A" | undefined }>;
  hasLiveGames: boolean;
  showLiveOnly: boolean;
  onToggleLiveOnly: (value: boolean) => void;
  scoreComponent: ReactNode | null;
  fixturesLoading: boolean;
  hasCheckedCache: boolean;
  currentGw: number | null;
  showPickButtons?: boolean;
  userPicks?: Record<number, "H" | "D" | "A">;
  liveScores?: Record<number, { 
    homeScore: number; 
    awayScore: number; 
    status: string; 
    minute?: number | null;
    goals?: any[] | null;
    red_cards?: any[] | null;
    home_team?: string | null;
    away_team?: string | null;
    result?: "H" | "D" | "A" | null;
  }>;
  userName?: string;
  globalRank?: number;
}

export function GamesSection({
  isInApiTestLeague,
  fixtures,
  fixtureCards,
  hasLiveGames: _hasLiveGames,
  showLiveOnly: _showLiveOnly,
  onToggleLiveOnly: _onToggleLiveOnly,
  scoreComponent,
  fixturesLoading,
  hasCheckedCache,
  currentGw,
  showPickButtons = true,
  userPicks = {},
  liveScores = {},
  userName,
  globalRank,
}: GamesSectionProps) {
  const { user } = useAuth();
  // Use userName from props, or get it directly from user, or fallback to 'User'
  const displayUserName = userName || user?.user_metadata?.display_name || user?.email || 'User';
  
  // Calculate title with GW number: "Gameweek (XX)" format
  const title = useMemo(() => {
    if (fixtures.length === 0) return "Games";
    
    // Always use the GW number from fixtures or currentGw, no test week distinction
    const gw = currentGw ?? fixtures[0]?.gw ?? 1;
    return `Gameweek ${gw}`;
  }, [fixtures, currentGw]);

  // Convert fixtures to GameweekFixturesCardList format
  const shareableFixtures = useMemo<Fixture[]>(() => {
    if (!fixtures || fixtures.length === 0) {
      return [];
    }
    return fixtures.map(f => ({
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
  }, [fixtures]);
  
  // Ensure we have the latest userPicks and liveScores
  // Use the props directly, not stale closures
  const latestUserPicks = userPicks || {};
  const latestLiveScores = liveScores || {};

  // Convert liveScores Record to Map for GameweekFixturesCardList
  const liveScoresMap = useMemo<Map<number, LiveScore>>(() => {
    const map = new Map<number, LiveScore>();
    Object.entries(liveScores).forEach(([fixtureIndexStr, score]) => {
      const fixtureIndex = parseInt(fixtureIndexStr, 10);
      map.set(fixtureIndex, {
        status: score.status as any,
        minute: score.minute ?? null,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        home_team: score.home_team ?? null,
        away_team: score.away_team ?? null,
        goals: score.goals?.map(g => ({
          team: g.team || '',
          scorer: g.scorer || '',
          minute: g.minute ?? null,
        })) ?? undefined,
        red_cards: score.red_cards?.map(r => ({
          team: r.team || '',
          player: r.player || '',
          minute: r.minute ?? null,
        })) ?? undefined,
        result: score.result ?? undefined,
      } as LiveScore);
    });
    return map;
  }, [liveScores]);

  // Share functionality
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [shareUserPicks, setShareUserPicks] = useState<Record<number, "H" | "D" | "A">>({});
  const [shareLiveScores, setShareLiveScores] = useState<Record<number, any>>({});
  const [shareGwRankPercent, setShareGwRankPercent] = useState<number | undefined>(undefined);

  const handleShare = async () => {
    console.log('[Share] handleShare called', { 
      isSharing, 
      displayUserName, 
      fixturesCount: fixtures.length,
      userPicksCount: Object.keys(userPicks || {}).length,
      liveScoresCount: Object.keys(liveScores || {}).length,
      fixturesLoading
    });
    if (isSharing) {
      console.log('[Share] Already sharing, returning');
      return;
    }
    
    setIsSharing(true);
    
    // Ensure we have fixtures before proceeding
    if (!fixtures || fixtures.length === 0) {
      console.error('[Share] No fixtures available');
      alert('Fixtures are still loading. Please try again in a moment.');
      setIsSharing(false);
      return;
    }
    
    const currentGwValue = currentGw ?? fixtures[0]?.gw ?? 1;
    const userId = user?.id;
    
    // Fetch data directly from Supabase (like UserPicksModal does) to ensure we have the latest data
    let fetchedPicks: Record<number, "H" | "D" | "A"> = {};
    let fetchedLiveScores: Record<number, any> = {};
    
    try {
      // Fetch picks for current user and gameweek
      if (userId) {
        const { data: picksData, error: picksError } = await supabase
          .from('app_picks')
          .select('fixture_index, pick')
          .eq('gw', currentGwValue)
          .eq('user_id', userId);
        
        if (picksError) {
          console.error('[Share] Error fetching picks:', picksError);
        } else {
          (picksData ?? []).forEach((p: any) => {
            fetchedPicks[p.fixture_index] = p.pick;
          });
          console.log('[Share] Fetched picks:', fetchedPicks);
        }
      }
      
      // Calculate GW rank percentage using app_v_gw_points view (same as UserPicksModal and ScoreIndicator)
      if (userId) {
        const { data: gwPointsData, error: gwPointsError } = await supabase
          .from('app_v_gw_points')
          .select('user_id, points')
          .eq('gw', currentGwValue);

        if (!gwPointsError && gwPointsData && gwPointsData.length > 0) {
          // Sort by points descending
          const sorted = [...gwPointsData].sort((a, b) => (b.points || 0) - (a.points || 0));
          
          // Find user's rank (handling ties - same rank for same points)
          let userRank = 1;
          for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i - 1].points !== sorted[i].points) {
              userRank = i + 1;
            }
            if (sorted[i].user_id === userId) {
              break;
            }
          }

          // Calculate rank percentage: (rank / total_users) * 100
          const totalUsers = sorted.length;
          const rankPercent = Math.round((userRank / totalUsers) * 100);
          setShareGwRankPercent(rankPercent);
          
          console.log('[Share] Calculated GW rank percent:', rankPercent, 'userRank:', userRank, 'totalUsers:', totalUsers);
        } else {
          setShareGwRankPercent(undefined);
        }
      }
      
      // Fetch live scores - use the existing liveScores prop if available, otherwise fetch
      if (Object.keys(liveScores || {}).length === 0) {
        // Get api_match_ids from fixtures
        const apiMatchIds = fixtures
          .map(f => f.api_match_id)
          .filter((id): id is number => id !== null && id !== undefined);
        
        if (apiMatchIds.length > 0) {
          const { data: liveScoresData, error: liveScoresError } = await supabase
            .from('live_scores')
            .select('*')
            .in('api_match_id', apiMatchIds);
          
          if (liveScoresError) {
            console.error('[Share] Error fetching live scores:', liveScoresError);
          } else {
            // Convert to Record<fixture_index, score> format
            (liveScoresData ?? []).forEach((score: any) => {
              const fixture = fixtures.find(f => f.api_match_id === score.api_match_id);
              if (fixture) {
                fetchedLiveScores[fixture.fixture_index] = {
                  homeScore: score.home_score ?? 0,
                  awayScore: score.away_score ?? 0,
                  status: score.status || 'SCHEDULED',
                  minute: score.minute ?? null,
                  goals: score.goals ?? null,
                  red_cards: score.red_cards ?? null,
                  home_team: score.home_team ?? null,
                  away_team: score.away_team ?? null,
                };
              }
            });
            console.log('[Share] Fetched live scores:', fetchedLiveScores);
          }
        }
      } else {
        fetchedLiveScores = liveScores || {};
      }
    } catch (error) {
      console.error('[Share] Error fetching data:', error);
      // Continue anyway with existing props
      fetchedPicks = userPicks || {};
      fetchedLiveScores = liveScores || {};
    }
    
    // Use fetched data or fall back to props
    const finalUserPicks = Object.keys(fetchedPicks).length > 0 ? fetchedPicks : (userPicks || {});
    const finalLiveScores = Object.keys(fetchedLiveScores).length > 0 ? fetchedLiveScores : (liveScores || {});
    
    // Store the fetched data in state so the capture component can use it
    setShareUserPicks(finalUserPicks);
    setShareLiveScores(finalLiveScores);
    
    console.log('[Share] Final data to use:', {
      fixturesCount: fixtures.length,
      userPicksCount: Object.keys(finalUserPicks).length,
      liveScoresCount: Object.keys(finalLiveScores).length,
    });
    
    console.log('[Share] Starting share process', {
      fixturesCount: fixtures.length,
      userPicksCount: Object.keys(finalUserPicks).length,
      liveScoresCount: Object.keys(finalLiveScores).length,
    });
    setIsSharing(true);
    // Open ShareSheet immediately with loading state
    setShowShareSheet(true);
    setShareImageUrl(null); // Ensure it starts as null to show loading
    setShowCaptureModal(true);
    
    // Wait longer for modal to fully render and layout to settle
    // Multiple animation frames and delays to ensure everything is ready
    // Also wait for React to update the component with latest props
    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased initial wait
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); // Extra frame
    await new Promise(resolve => setTimeout(resolve, 300)); // Increased final wait
    
    // Wait for ref to be set (with timeout)
    let retries = 0;
    while (!captureRef.current && retries < 15) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    console.log('[Share] Ref check complete', { hasRef: !!captureRef.current, retries });
    
    // Force multiple reflows to ensure layout is calculated
    if (captureRef.current) {
      void captureRef.current.offsetHeight;
      void captureRef.current.offsetWidth;
      // Force another reflow
      await new Promise(resolve => requestAnimationFrame(resolve));
      void captureRef.current.offsetHeight;
    }
    
    try {
      if (!captureRef.current) {
        throw new Error('Capture element not found - ref was not set after retries');
      }
      
      const element = captureRef.current;
      
      // Check if element is actually in the DOM and visible
      if (!element.offsetParent && element.style.display !== 'none') {
        console.warn('Capture element may not be visible');
      }
      
      // Wait for all images in the element to load, and hide any that fail
      // Special handling for Volley image - ensure it loads in Despia
      const images = element.querySelectorAll('img');
      console.log('[Share] Found images to load:', images.length, Array.from(images).map(img => img.src));
      await Promise.all(Array.from(images).map((img: HTMLImageElement) => {
        // Volley image needs extra time in Despia
        const isVolleyImage = img.src.includes('Volley') || img.src.includes('volley');
        const timeout = isVolleyImage ? 5000 : 3000; // Give Volley images more time
        
        if (img.complete && img.naturalWidth > 0) {
          if (isVolleyImage) {
            console.log('[Share] Volley image already loaded:', img.src);
          }
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            if (isVolleyImage) {
              console.warn('[Share] Volley image load timeout, hiding:', img.src);
            } else {
              console.warn('[Share] Image load timeout, hiding:', img.src);
            }
            // Hide image if it fails to load to prevent capture errors
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null); // Continue even if image fails
          }, timeout);
          img.onload = () => {
            clearTimeout(timeoutId);
            if (isVolleyImage) {
              console.log('[Share] Volley image loaded successfully:', img.src);
            } else {
              console.log('[Share] Image loaded successfully:', img.src);
            }
            resolve(null);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            if (isVolleyImage) {
              console.error('[Share] Volley image load error, hiding:', img.src);
            } else {
              console.error('[Share] Image load error, hiding:', img.src);
            }
            // Hide image if it fails to load to prevent capture errors
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
            resolve(null); // Continue even if image fails
          };
        });
      }));
      
      // Additional wait to ensure everything is settled
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Hide any images that failed to load before capture
      Array.from(images).forEach((img: HTMLImageElement) => {
        if (!img.complete || img.naturalWidth === 0) {
          console.warn('[Share] Hiding incomplete image before capture:', img.src);
          img.style.display = 'none';
          img.style.visibility = 'hidden';
          img.style.opacity = '0';
        }
      });
      
      // Use html-to-image which handles flexbox much better
      console.log('[Share] Starting toPng capture', { elementWidth: element.offsetWidth, elementHeight: element.offsetHeight });
      let dataUrl: string;
      try {
        dataUrl = await toPng(element, {
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
              // Skip images that haven't loaded
              if (!node.complete || node.naturalWidth === 0) {
                return false;
              }
            }
            return true;
          },
        });
        console.log('[Share] toPng capture successful', { dataUrlLength: dataUrl?.length });
      } catch (pngError: any) {
        console.error('[Share] toPng error:', pngError);
        // Handle Event objects and other error types
        let errorMsg = 'Unknown html-to-image error';
        if (pngError instanceof Error) {
          errorMsg = pngError.message;
        } else if (pngError?.message) {
          errorMsg = pngError.message;
        } else if (pngError?.type) {
          // Event object - extract type and other info
          const eventInfo = [pngError.type];
          if (pngError.target) eventInfo.push(`target: ${pngError.target.constructor?.name || 'unknown'}`);
          if (pngError.currentTarget) eventInfo.push(`currentTarget: ${pngError.currentTarget.constructor?.name || 'unknown'}`);
          errorMsg = `html-to-image error: ${eventInfo.join(', ')}`;
        } else if (typeof pngError === 'string') {
          errorMsg = pngError;
        } else if (pngError?.toString && pngError.toString() !== '[object Object]' && pngError.toString() !== '[object Event]') {
          errorMsg = pngError.toString();
        } else if (pngError?.toString && pngError.toString() === '[object Event]') {
          // It's an Event object - try to get more info
          errorMsg = `html-to-image failed (likely CORS or security restriction)`;
        }
        throw new Error(`Failed to capture image: ${errorMsg}`);
      }
      
      if (!dataUrl || dataUrl.length === 0) {
        throw new Error('Image capture returned empty data');
      }
      
      // Load the image to get dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image load timeout after 5 seconds'));
        }, 5000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        
        img.onerror = (e) => {
          clearTimeout(timeout);
          console.error('Image load error:', e);
          reject(new Error('Failed to load captured image data'));
        };
        
        img.src = dataUrl;
      });
      
      // Target dimensions (2:3 aspect ratio - taller card)
      const targetWidth = 1500;
      const targetHeight = 2250;
      
      // Create final canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      const ctx = finalCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas 2D context');
      }
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      
      // Scale image to fit within canvas dimensions (maintain aspect ratio)
      const scaleX = targetWidth / img.width;
      const scaleY = targetHeight / img.height;
      const imageScale = Math.min(scaleX, scaleY); // Use smaller scale to ensure it fits
      
      const scaledWidth = img.width * imageScale;
      const scaledHeight = img.height * imageScale;
      
      // Center the image vertically and horizontally
      const imageX = (targetWidth - scaledWidth) / 2;
      const imageY = (targetHeight - scaledHeight) / 2;
      
      ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);

      setShowCaptureModal(false);
      const imageUrl = finalCanvas.toDataURL('image/png', 0.95);
      
      if (!imageUrl || imageUrl.length === 0) {
        throw new Error('Failed to generate final image data URL');
      }
      
      console.log('[Share] Setting share image URL', { imageUrlLength: imageUrl?.length });
      setShareImageUrl(imageUrl);
      setIsSharing(false);
      console.log('[Share] Share process completed successfully');
    } catch (error: any) {
      console.error('Error generating share image:', error);
      const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
      console.error('Error details:', {
        message: errorMessage,
        stack: error?.stack,
        name: error?.name,
        error
      });
      alert(`Failed to generate image: ${errorMessage}`);
      setShowCaptureModal(false);
      setIsSharing(false);
    } finally {
      // Ensure we always reset the sharing state
      if (isSharing) {
        setIsSharing(false);
      }
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

  const currentGwValue = currentGw ?? fixtures[0]?.gw ?? 1;

  return (
    <>
      {/* Temporary modal for capture - invisible but in viewport for html-to-image */}
      {showCaptureModal && displayUserName && (
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
            {(() => {
              const logData = {
                gw: currentGwValue,
                fixturesCount: shareableFixtures.length,
                picksCount: Object.keys(latestUserPicks).length,
                liveScoresCount: liveScoresMap.size,
                userName: displayUserName,
                globalRank,
                fixturesLoading,
              };
              console.log('[Share] Rendering capture component with:', logData);
              console.log('[Share] First fixture:', shareableFixtures[0]);
              console.log('[Share] All fixtures:', shareableFixtures);
              console.log('[Share] userPicks prop:', userPicks);
              console.log('[Share] latestUserPicks:', latestUserPicks);
              console.log('[Share] userPicks keys:', Object.keys(latestUserPicks));
              console.log('[Share] userPicks entries:', Object.entries(latestUserPicks));
              console.log('[Share] userPicks object:', JSON.stringify(latestUserPicks));
              console.log('[Share] liveScores prop (raw):', liveScores);
              console.log('[Share] latestLiveScores:', latestLiveScores);
              console.log('[Share] liveScores prop keys:', Object.keys(latestLiveScores));
              console.log('[Share] liveScores prop entries:', Object.entries(latestLiveScores));
              console.log('[Share] liveScoresMap size:', liveScoresMap.size);
              console.log('[Share] liveScoresMap keys:', Array.from(liveScoresMap.keys()));
              console.log('[Share] liveScoresMap entries:', Array.from(liveScoresMap.entries()));
              return null;
            })()}
            <GameweekFixturesCardListForCapture
              gw={currentGwValue}
              fixtures={shareableFixtures}
              picks={Object.keys(shareUserPicks).length > 0 ? shareUserPicks : latestUserPicks}
              liveScores={(() => {
                // Convert shareLiveScores to Map if available, otherwise use liveScoresMap
                if (Object.keys(shareLiveScores).length > 0) {
                  const map = new Map<number, LiveScore>();
                  Object.entries(shareLiveScores).forEach(([fixtureIndexStr, score]) => {
                    const fixtureIndex = parseInt(fixtureIndexStr, 10);
                    map.set(fixtureIndex, {
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
                    } as LiveScore);
                  });
                  return map;
                }
                return liveScoresMap;
              })()}
              userName={displayUserName}
              globalRank={globalRank}
              gwRankPercent={shareGwRankPercent}
              onCardRefReady={(ref) => {
                captureRef.current = ref.current;
              }}
            />
          </div>
        </div>
      )}
      
      <Section 
        title={title}
        className="mt-8"
        showInfoIcon={false}
      >
        {(!hasCheckedCache || fixturesLoading) ? (
          <div className="p-4 text-slate-500">Loading fixtures...</div>
        ) : fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : fixtures.length > 0 ? (
          <>
            {/* Regular DateGroupedFixtures view */}
            <DateGroupedFixtures
              fixtureCards={fixtureCards}
              isTestApi={isInApiTestLeague}
              showPickButtons={showPickButtons}
              headerRightElement={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-full bg-[#1C8376] text-white text-xs sm:text-sm font-medium hover:bg-[#156b60] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Share gameweek predictions"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>Share</span>
                  </button>
                  {scoreComponent}
                </div>
              }
            />
          </>
        ) : null}
      </Section>

      {/* Share Sheet - show immediately with loading state */}
      {showShareSheet && displayUserName && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={handleCloseShareSheet}
          imageUrl={shareImageUrl || ''}
          fileName={`${displayUserName}'s Predictions Totl Gameweek ${currentGwValue}.png`}
          gw={currentGwValue}
          userName={displayUserName}
        />
      )}
    </>
  );
}

