import { useMemo, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import Section from './Section';
import { type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from './FixtureCard';
import DateGroupedFixtures from './DateGroupedFixtures';
import GameweekFixturesCardListForCapture from './GameweekFixturesCardListForCapture';
import ShareSheet from './ShareSheet';
import type { Fixture, LiveScore } from './FixtureCard';
import { toPng } from 'html-to-image';
import { getFullName } from '../lib/teamNames';

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
  hasLiveGames,
  showLiveOnly,
  onToggleLiveOnly,
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
  // Calculate title with GW number: "Gameweek (XX)" format
  const title = useMemo(() => {
    if (fixtures.length === 0) return "Games";
    
    // Always use the GW number from fixtures or currentGw, no test week distinction
    const gw = currentGw ?? fixtures[0]?.gw ?? 1;
    return `Gameweek ${gw}`;
  }, [fixtures, currentGw]);

  // Convert fixtures to GameweekFixturesCardList format
  const shareableFixtures = useMemo<Fixture[]>(() => {
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

  const handleShare = async () => {
    if (isSharing) return;
    
    setIsSharing(true);
    setShowCaptureModal(true);
    
    // Wait longer for modal to fully render and layout to settle
    await new Promise(resolve => setTimeout(resolve, 800));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    
    // Wait for ref to be set (with timeout)
    let retries = 0;
    while (!captureRef.current && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    // Force a reflow to ensure layout is calculated
    if (captureRef.current) {
      void captureRef.current.offsetHeight;
    }
    
    try {
      if (!captureRef.current) {
        throw new Error('Capture element not found - ref was not set');
      }
      
      const element = captureRef.current;
      
      // Use html-to-image which handles flexbox much better
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.95,
        cacheBust: true,
      });
      
      // Load the image to get dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 5000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load image'));
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
      
      if (ctx) {
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
      }

      setShowCaptureModal(false);
      const imageUrl = finalCanvas.toDataURL('image/png', 0.95);
      setShareImageUrl(imageUrl);
      setShowShareSheet(true);
      setIsSharing(false);
    } catch (error) {
      console.error('Error generating share image:', error);
      alert(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              gw={currentGwValue}
              fixtures={shareableFixtures}
              picks={userPicks}
              liveScores={liveScoresMap}
              userName={userName}
              globalRank={globalRank}
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
                  {userName && (
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-full bg-[#1C8376] text-white text-xs sm:text-sm font-medium hover:bg-[#156b60] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Share gameweek predictions"
                    >
                      {isSharing ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                  {scoreComponent}
                </div>
              }
            />
          </>
        ) : null}
      </Section>

      {/* Share Sheet */}
      {showShareSheet && shareImageUrl && userName && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={handleCloseShareSheet}
          imageUrl={shareImageUrl}
          fileName={`totl-gw${currentGwValue}-${userName.replace(/\s+/g, '-')}.png`}
          gw={currentGwValue}
          userName={userName}
        />
      )}
    </>
  );
}

