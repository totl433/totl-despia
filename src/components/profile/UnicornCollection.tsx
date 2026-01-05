import { useState, useEffect, useRef } from 'react';
import { fetchUserUnicorns, type UnicornCard as UnicornCardData } from '../../services/unicorns';
import UnicornCard from './UnicornCard';
import InfoSheet from '../InfoSheet';

interface UnicornCollectionProps {
 userId: string;
 loading?: boolean;
}

export default function UnicornCollection({ userId, loading: externalLoading }: UnicornCollectionProps) {
 const [unicorns, setUnicorns] = useState<UnicornCardData[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeIndex, setActiveIndex] = useState(0);
 const [isInfoOpen, setIsInfoOpen] = useState(false);
 const containerRef = useRef<HTMLDivElement>(null);
 const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

 useEffect(() => {
 if (!userId) {
 setLoading(false);
 return;
 }

 let alive = true;

 async function loadUnicorns() {
 setLoading(true);
 try {
 const data = await fetchUserUnicorns(userId);
 if (alive) {
 // Clear card refs when new data loads
 cardRefs.current = [];
 setUnicorns(data);
 // Reset active index when new unicorns load
 setActiveIndex(0);
 }
 } catch (error) {
 console.error('[UnicornCollection] Error loading unicorns:', error);
 if (alive) {
 setUnicorns([]);
 setActiveIndex(0);
 }
 } finally {
 if (alive) {
 setLoading(false);
 }
 }
 }

 loadUnicorns();

 return () => {
 alive = false;
 };
 }, [userId]);

 // Track which card is centered using scroll position
 useEffect(() => {
 if (unicorns.length === 0 || !containerRef.current) return;

 const container = containerRef.current;
 let rafId: number | null = null;
 let ticking = false;
 
 const calculateActiveIndex = () => {
 if (!containerRef.current) return;
 
 // Ensure container has been laid out (has width)
 const containerRect = containerRef.current.getBoundingClientRect();
 if (containerRect.width === 0) {
 // Container not laid out yet, retry
 setTimeout(calculateActiveIndex, 50);
 return;
 }
 
 // Ensure all card refs are populated
 const allRefsReady = cardRefs.current.every((ref, idx) => {
 if (idx >= unicorns.length) return true; // Skip extra refs
 return ref !== null;
 });
 
 if (!allRefsReady) {
 // Retry after a short delay if refs aren't ready
 setTimeout(calculateActiveIndex, 50);
 return;
 }
 
 // Ensure at least the first card has been laid out
 if (cardRefs.current[0]) {
 const firstCardRect = cardRefs.current[0].getBoundingClientRect();
 if (firstCardRect.width === 0) {
 // Cards not laid out yet, retry
 setTimeout(calculateActiveIndex, 50);
 return;
 }
 }
 
 const containerCenter = containerRect.left + containerRect.width / 2;
 
 let closestIndex = 0;
 let closestDistance = Infinity;
 
 cardRefs.current.forEach((card, index) => {
 if (card && index < unicorns.length) {
 const cardRect = card.getBoundingClientRect();
 const cardCenter = cardRect.left + cardRect.width / 2;
 const distance = Math.abs(cardCenter - containerCenter);
 
 if (distance < closestDistance) {
 closestDistance = distance;
 closestIndex = index;
 }
 }
 });
 
 setActiveIndex(closestIndex);
 };
 
 const handleScroll = () => {
 if (!ticking) {
 rafId = requestAnimationFrame(() => {
 calculateActiveIndex();
 ticking = false;
 });
 ticking = true;
 }
 };

 container.addEventListener('scroll', handleScroll, { passive: true });
 
 // Ensure scroll position is correct initially (should be at 0 due to paddingLeft)
 // But recalculate active index after layout
 const ensureInitialPosition = () => {
 if (container.scrollLeft === 0 && cardRefs.current[0]) {
 // Scroll position is at start, first card should be centered
 // But verify with calculation
 calculateActiveIndex();
 } else {
 // If scroll position changed, recalculate
 calculateActiveIndex();
 }
 };
 
 // Wait for layout to complete before initial calculation
 // Use multiple strategies to ensure cards are positioned
 const timeout1 = setTimeout(() => {
 ensureInitialPosition();
 }, 0);
 
 const timeout2 = setTimeout(() => {
 ensureInitialPosition();
 }, 100);
 
 const timeout3 = setTimeout(() => {
 ensureInitialPosition();
 }, 300);
 
 // Also recalculate on resize
 const handleResize = () => {
 calculateActiveIndex();
 };
 window.addEventListener('resize', handleResize, { passive: true });

 return () => {
 clearTimeout(timeout1);
 clearTimeout(timeout2);
 clearTimeout(timeout3);
 if (rafId !== null) {
 cancelAnimationFrame(rafId);
 }
 container.removeEventListener('scroll', handleScroll);
 window.removeEventListener('resize', handleResize);
 };
 }, [unicorns.length, unicorns]);

 const isLoading = externalLoading || loading;

 // Don't render anything until external loading is complete to prevent flash
 if (externalLoading) {
 return null;
 }

 if (isLoading) {
 return (
 <div className="bg-white rounded-xl p-6 desktop-constrained-unicorn" style={{ marginRight: '-100vw', paddingRight: '100vw' }}>
 <div className="text-sm font-medium text-slate-600 mb-4 flex items-center gap-2">
 <h2 className="text-lg font-bold text-slate-800">Your Unicorns</h2>
 </div>
 <div className="h-8 bg-slate-200 rounded animate-pulse" />
 </div>
 );
 }

 if (unicorns.length === 0) {
 return (
 <div className="bg-white rounded-xl p-6">
 <div className="text-sm font-medium text-slate-600 mb-2">
 Your Unicorns
 </div>
 <div className="text-slate-500 text-sm">
 You have <span className="font-semibold">0 unicorns</span> overall. Keep predicting to earn your first unicorn!
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl p-6 desktop-constrained-unicorn" style={{ marginRight: '-100vw', paddingRight: '100vw' }}>
 <div className="text-sm font-medium text-slate-600 mb-4 flex items-center gap-2" style={{ paddingLeft: '1.5rem', marginLeft: '-1.5rem' }}>
 <h2 className="text-lg font-bold text-slate-800">Your Unicorns</h2>
 <div 
 className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center cursor-pointer"
 onClick={() => setIsInfoOpen(true)}
 role="button"
 aria-label="Information about Unicorns"
 >
 <span className="text-[10px] text-slate-500 font-bold">i</span>
 </div>
 </div>
 
 <div 
 ref={containerRef}
 className="flex gap-0 overflow-x-auto pb-2 scrollbar-hide unicorn-scroll-container"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 overscrollBehaviorX: 'contain',
 scrollBehavior: 'smooth',
 scrollSnapType: 'x mandatory',
 marginLeft: '-1.5rem',
 marginRight: '-1.5rem',
 paddingLeft: 'calc(50vw - 140px + 1.5rem)',
 paddingRight: 'calc(50vw - 140px)',
 width: 'calc(100% + 3rem)',
 }}
 >
 <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
 {unicorns.map((unicorn, index) => (
 <div
 key={`${unicorn.gw}-${unicorn.fixture_index}-${index}`}
 ref={(el) => {
 cardRefs.current[index] = el;
 }}
 >
 <UnicornCard
 fixture={unicorn}
 leagueNames={unicorn.league_names}
 isActive={index === activeIndex}
 />
 </div>
 ))}
 </div>
 
 <div className="text-sm font-bold text-slate-800 mt-4 text-center">
 {unicorns.length} {unicorns.length === 1 ? 'unicorn' : 'unicorns'} overall
 </div>
 
 <InfoSheet
 isOpen={isInfoOpen}
 onClose={() => setIsInfoOpen(false)}
 title="Unicorns"
 description={`A unicorn is a unique correct prediction in a mini-league.

Only applies to mini-leagues with 3+ players.

Each card shows the fixture you correctly predicted, what you picked, and which mini-leagues you earned the unicorn in.`}
 />
 </div>
 );
}

