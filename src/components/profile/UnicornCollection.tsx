import { useState, useEffect, useRef } from 'react';
import { fetchUserUnicorns, type UnicornCard } from '../../services/unicorns';
import UnicornCard from './UnicornCard';
import InfoSheet from '../InfoSheet';

interface UnicornCollectionProps {
  userId: string;
  loading?: boolean;
}

export default function UnicornCollection({ userId, loading: externalLoading }: UnicornCollectionProps) {
  const [unicorns, setUnicorns] = useState<UnicornCard[]>([]);
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
          setUnicorns(data);
        }
      } catch (error) {
        console.error('[UnicornCollection] Error loading unicorns:', error);
        if (alive) {
          setUnicorns([]);
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
    
    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      cardRefs.current.forEach((card, index) => {
        if (card) {
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

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [unicorns.length]);

  const isLoading = externalLoading || loading;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <div className="text-sm font-medium text-slate-600 mb-4">
          Your Unicorns
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
    <div className="bg-white rounded-xl p-6" style={{ marginRight: '-100vw', paddingRight: '100vw' }}>
      <div className="text-sm font-medium text-slate-600 mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold text-slate-800">Your Unicorns</h2>
        <div 
          className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => setIsInfoOpen(true)}
          role="button"
          aria-label="Information about Unicorns"
        >
          <span className="text-[10px] text-slate-500 font-bold">i</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex gap-0 overflow-x-auto pb-2 scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollBehavior: 'smooth',
          scrollSnapType: 'x mandatory',
          marginRight: '-1.5rem',
          paddingLeft: '0',
          paddingRight: 'max(1.5rem, calc(100vw - 280px - 1.5rem))',
          width: 'calc(100% + 1.5rem)',
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

