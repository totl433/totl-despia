import { Link } from "react-router-dom";
import React, { useState, useRef } from "react";
import ShareSheet from "./ShareSheet";
import GameweekFixturesCardListForCapture from "./GameweekFixturesCardListForCapture";
import { toPng } from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatPercentage } from '../lib/formatPercentage';

type LeaderboardCardProps = {
  title: string;
  badgeSrc?: string;
  badgeAlt?: string;
  linkTo: string;
  rank: number | null;
  total: number | null;
  score?: number;
  gw?: number;
  totalFixtures?: number;
  subtitle?: string;
  variant?: 'default' | 'lastGw'; // Special variant for Last GW card
  isActiveLive?: boolean; // Show live score indicator when live scores are being used to calculate points
};

export const LeaderboardCard = React.memo(function LeaderboardCard({
  title,
  badgeSrc,
  badgeAlt,
  linkTo,
  rank,
  total,
  score,
  gw,
  totalFixtures,
  subtitle,
  variant = 'default',
  isActiveLive = false,
}: LeaderboardCardProps) {
  // Calculate rank percentage: (rank / total) * 100
  // This is already the percentile, so we can use it directly
  const rankPercent = rank && total && total > 0 
    ? Math.round((rank / total) * 100)
    : null;
  const formattedPercent = formatPercentage(rankPercent);
  const displayText = formattedPercent?.text || "—";

  // Special variant for Last GW card (shows score prominently)
  if (variant === 'lastGw') {
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
    const [gwRankPercent, setGwRankPercent] = useState<number | undefined>(undefined);
    
    // Share functionality - currently unused but kept for future use
    // @ts-ignore - intentionally unused
    const handleShare = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isSharing) return;
      if (!gw || !user?.id) return;
      
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
          .eq('gw', gw)
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
          .eq('gw', gw)
          .eq('user_id', user.id);
        
        const picksMap: Record<number, "H" | "D" | "A"> = {};
        (picksData || []).forEach((p: any) => {
          picksMap[p.fixture_index] = p.pick;
        });
        setSharePicks(picksMap);
        
        // Fetch all GW points to calculate GW rank percentage
        const { data: allGwPointsData, error: gwPointsError } = await supabase
          .from('app_v_gw_points')
          .select('user_id, points')
          .eq('gw', gw);

        if (!gwPointsError && allGwPointsData) {
          const sortedGwPoints = [...allGwPointsData].sort((a, b) => b.points - a.points);
          const totalUsers = sortedGwPoints.length;

          if (totalUsers > 0) {
            let userGwRank: number | undefined;
            let currentRank = 1;
            for (let i = 0; i < sortedGwPoints.length; i++) {
              if (i > 0 && sortedGwPoints[i - 1].points !== sortedGwPoints[i].points) {
                currentRank = i + 1;
              }
              if (sortedGwPoints[i].user_id === user.id) {
                userGwRank = currentRank;
                break;
              }
            }

            if (userGwRank !== undefined) {
              // Calculate rank percentage: (rank / total) * 100
              // This is already the percentile, so we can use it directly
              const rankPercent = Math.round((userGwRank / totalUsers) * 100);
              setGwRankPercent(rankPercent);
            } else {
              setGwRankPercent(undefined);
            }
          } else {
            setGwRankPercent(undefined);
          }
        } else {
          setGwRankPercent(undefined);
        }
        
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
        
        // Wait for images to load - exactly like GamesSection
        // Special handling for Volley image - ensure it loads in Despia
        const images = element.querySelectorAll('img');
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
                console.warn('[Share] Volley image load timeout:', img.src);
              }
              img.style.display = 'none';
              img.style.visibility = 'hidden';
              img.style.opacity = '0';
              resolve(null);
            }, timeout);
            img.onload = () => { 
              clearTimeout(timeoutId); 
              if (isVolleyImage) {
                console.log('[Share] Volley image loaded successfully:', img.src);
              }
              resolve(null); 
            };
            img.onerror = () => { 
              clearTimeout(timeoutId); 
              if (isVolleyImage) {
                console.error('[Share] Volley image load error:', img.src);
              }
              img.style.display = 'none';
              img.style.visibility = 'hidden';
              img.style.opacity = '0';
              resolve(null); 
            };
          });
        }));
        
        // Hide incomplete images
        Array.from(images).forEach((img: HTMLImageElement) => {
          if (!img.complete || img.naturalWidth === 0) {
            img.style.display = 'none';
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
        console.error('Error generating share image:', error);
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
    
    return (
      <>
        <Link to={linkTo} className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
          <div className="p-3 h-full flex flex-col relative">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-baseline gap-[3px]" style={{ marginTop: '-4px' }}>
                {score !== undefined && totalFixtures !== undefined ? (
                  <>
                    <span className="text-[#1C8376] text-[38px] font-normal leading-none">{score}</span>
                    <div className="flex items-baseline gap-[4px]">
                      <span className="text-slate-500 text-lg font-normal leading-none">/</span>
                      <span className="text-slate-500 text-lg font-normal leading-none">{totalFixtures}</span>
                    </div>
                  </>
                ) : (
                  <span className="leading-none text-slate-900">—</span>
                )}
              </div>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {isActiveLive && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                <span className="text-xs font-bold text-red-600">Live</span>
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              </div>
            )}
            <div className="mt-auto">
              <div className="text-xs text-slate-500 mb-2">
                <span>Gameweek {gw ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-slate-900">
                  {displayText}
                </span>
              </div>
            </div>
          </div>
        </Link>
        
        {/* Capture modal for share image generation - exactly like GamesSection */}
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
                gw={gw!}
                fixtures={shareFixtures}
                picks={sharePicks}
                liveScores={shareLiveScores}
                userName={userName}
                globalRank={rank ?? undefined}
                gwRankPercent={gwRankPercent}
                onCardRefReady={(ref) => {
                  // Store the ref element directly
                  if (ref?.current) {
                    captureRef.current = ref.current;
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
            fileName={`${userName}'s Predictions Totl Gameweek ${gw}.png`}
            gw={gw!}
            userName={userName}
          />
        )}
      </>
    );
  }

  // Default variant
  return (
    <Link to={linkTo} className="flex-shrink-0 w-[148px] h-[148px] rounded-xl border bg-white shadow-sm overflow-hidden cursor-pointer block">
      <div className="p-3 h-full flex flex-col relative">
        {isActiveLive && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            <span className="text-xs font-bold text-red-600">Live</span>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
          </div>
        )}
        <div className="flex items-start justify-between mb-2">
          {badgeSrc && <img src={badgeSrc} alt={badgeAlt || title} className="w-[32px] h-[32px]" />}
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div className="mt-auto">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
            {subtitle || title}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-900">
              {displayText}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

