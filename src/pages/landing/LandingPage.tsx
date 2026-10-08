import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  trackAppStoreClick,
  type AppStoreClickPlacement,
} from '../../lib/googleAnalytics';
import {
  APP_STORE_URL,
  setPreferPlayOnline,
} from '../../lib/playOnlinePreference';
import './LandingPage.css';

const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.despia.totlnative';

const MARQUEE_COPY =
  'PREMIER LEAGUE  •  PREDICTIONS  •  MINI LEAGUES  •  BRAGGING RIGHTS  •  ';

const predictionTeams = [
  { name: 'Arsenal', badge: '/assets/badges/ARS.png' },
  { name: 'Tottenham', badge: '/assets/badges/TOT.png' },
  { name: 'Manchester United', badge: '/assets/badges/MUN.png' },
] as const;

function StoreBadge({
  store,
  placement,
  slideId,
}: {
  store: 'apple' | 'google';
  placement: AppStoreClickPlacement;
  slideId: string;
}) {
  const isApple = store === 'apple';
  const href = isApple ? APP_STORE_URL : GOOGLE_PLAY_URL;

  return (
    <a
      className={`landing-store-badge landing-store-badge--${store}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={isApple ? 'Download TotL on the App Store' : 'Get TotL on Google Play'}
      onClick={() => {
        if (isApple) {
          trackAppStoreClick({ placement, slideId, linkUrl: href });
        }
      }}
    >
      <img
        src={
          isApple
            ? '/assets/get-app/app-store-badge-transparent.png'
            : '/assets/get-app/google-play-badge.png'
        }
        alt={isApple ? 'Download on the App Store' : 'Get it on Google Play'}
      />
    </a>
  );
}

function StoreBadges({
  placement = 'splash',
  slideId = 'landing',
}: {
  placement?: AppStoreClickPlacement;
  slideId?: string;
}) {
  return (
    <div className="landing-store-badges" aria-label="Download TotL">
      <StoreBadge store="google" placement={placement} slideId={slideId} />
      <StoreBadge store="apple" placement={placement} slideId={slideId} />
    </div>
  );
}

function VerticalMarquee({
  side,
}: {
  side: 'left' | 'right';
}) {
  const repeated = Array.from({ length: 5 }, (_, index) => (
    <span key={index}>{MARQUEE_COPY}</span>
  ));

  return (
    <div className={`landing-marquee landing-marquee--${side}`} aria-hidden="true">
      <div className="landing-marquee__track">
        <div>{repeated}</div>
        <div>{repeated}</div>
      </div>
    </div>
  );
}

function PhoneShowcase() {
  return (
    <div className="landing-phones" data-reveal="phones">
      <div className="landing-phone landing-phone--back">
        <img
          src="/assets/get-app/predict.jpg"
          alt="TotL Premier League match prediction screen"
          loading="eager"
        />
      </div>
      <div className="landing-phone landing-phone--front">
        <img
          src="/assets/get-app/form.jpg"
          alt="TotL form leaderboard screen"
          loading="eager"
        />
      </div>
    </div>
  );
}

function PredictionCard() {
  const [activeTeam, setActiveTeam] = useState(0);
  const team = predictionTeams[activeTeam];

  return (
    <div className="landing-prediction-card">
      <div className="landing-prediction-card__dots" role="tablist" aria-label="Choose a club">
        {predictionTeams.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={activeTeam === index}
            aria-label={`Show ${item.name}`}
            onClick={() => setActiveTeam(index)}
          />
        ))}
      </div>
      <div className="landing-prediction-card__visual">
        <img
          className="landing-prediction-card__screen"
          src="/assets/get-app/predict.jpg"
          alt="Swipe prediction cards for Premier League fixtures"
          loading="lazy"
        />
        <div className="landing-prediction-card__club" aria-live="polite">
          <img src={team.badge} alt="" />
          <span>{team.name}</span>
        </div>
      </div>
    </div>
  );
}

function FeatureSection({
  id,
  eyebrow,
  title,
  body,
  image,
  imageAlt,
  reverse = false,
  interactive = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  interactive?: boolean;
}) {
  return (
    <section
      id={id}
      className={`landing-feature ${reverse ? 'landing-feature--reverse' : ''}`}
    >
      <div className="landing-feature__copy" data-reveal>
        <p className="landing-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="landing-feature__media" data-reveal>
        {interactive ? (
          <PredictionCard />
        ) : (
          <img src={image} alt={imageAlt} loading="lazy" />
        )}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.classList.add('landing-page-active');
    document.body.classList.add('landing-page-active');
    return () => {
      document.documentElement.classList.remove('landing-page-active');
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    );

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function handlePlayOnline() {
    setPreferPlayOnline();
    if (user) {
      window.location.assign('/');
      return;
    }
    navigate('/auth?returnTo=/', { replace: true });
  }

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="TotL home">
          <img src="/assets/badges/totl-logo1.svg" alt="TotL" />
        </a>
        <nav className="landing-header__nav" aria-label="Coming soon">
          <span>How it works</span>
          <span>Features</span>
          <span>Leaderboards</span>
          <span>Mini leagues</span>
        </nav>
        <button type="button" className="landing-header__play" onClick={handlePlayOnline}>
          Play online
        </button>
      </header>

      <section className="landing-hero">
        <div className="landing-pattern" aria-hidden="true" />
        <div className="landing-hero__inner">
          <div className="landing-hero__copy" data-reveal>
            <div className="landing-brush" aria-hidden="true" />
            <p className="landing-eyebrow landing-eyebrow--light">Premier League predictions</p>
            <h1>
              Top of
              <br />
              the league
            </h1>
            <p className="landing-hero__lede">
              Premier League predictions,
              <br />
              mini leagues and bragging rights.
            </p>
            <StoreBadges />
          </div>

          <div className="landing-hero-card" data-reveal>
            <div className="landing-hero-card__top">
              <span>PREM PREDICTIONS</span>
              <span>•••</span>
            </div>
            <div className="landing-hero-card__tabs">
              <strong>Chat</strong>
              <span>GW Table</span>
              <span>Predictions</span>
            </div>
            <div className="landing-hero-card__message landing-hero-card__message--left">
              <strong>Jof</strong>
              Well... that was technically football
            </div>
            <div className="landing-hero-card__message landing-hero-card__message--right">
              Counting my three points.
            </div>
            <div className="landing-hero-card__input">Say something...</div>
          </div>
        </div>
      </section>

      <section className="landing-showcase" aria-labelledby="showcase-title">
        <VerticalMarquee side="left" />
        <VerticalMarquee side="right" />
        <div className="landing-showcase__shape landing-showcase__shape--one" aria-hidden="true" />
        <div className="landing-showcase__shape landing-showcase__shape--two" aria-hidden="true" />
        <div className="landing-showcase__inner">
          <PhoneShowcase />
          <div className="landing-showcase__copy" data-reveal>
            <h2 id="showcase-title">
              Psst, you don&apos;t know
              <br />
              anything about football!
            </h2>
            <p>Download now and earn your bragging rights.</p>
            <StoreBadges placement="feature_slide" slideId="phone-showcase" />
          </div>
        </div>
      </section>

      <section className="landing-features" aria-label="TotL features">
        <svg
          className="landing-bracket-line"
          viewBox="0 0 800 1900"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M400 0V170L240 330L560 650L240 970L560 1290L400 1450V1900"
            stroke="currentColor"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="400" cy="170" r="42" fill="white" stroke="currentColor" strokeWidth="18" />
          <circle cx="240" cy="970" r="42" fill="white" stroke="currentColor" strokeWidth="18" />
          <circle cx="400" cy="1450" r="42" fill="white" stroke="currentColor" strokeWidth="18" />
        </svg>

        <div className="landing-features__inner">
          <FeatureSection
            id="start-anytime"
            eyebrow="Keep moving"
            title="Start anytime and still compete"
            body="Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on."
            image="/assets/get-app/form.jpg"
            imageAlt="A ten-gameweek form leaderboard in TotL"
          />
          <FeatureSection
            id="global-leaderboard"
            eyebrow="Make your mark"
            title="Climb the global leaderboard"
            body="Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace."
            image="/assets/get-app/leaderboard.jpg"
            imageAlt="The TotL global leaderboard"
            reverse
          />
          <FeatureSection
            id="predict"
            eyebrow="Trust your gut"
            title="Predict every gameweek"
            body="Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong."
            image="/assets/get-app/predict.jpg"
            imageAlt="Premier League fixture prediction cards"
            interactive
          />
        </div>
      </section>

      <section className="landing-final-cta" data-reveal>
        <img src="/assets/badges/totl-logo1.svg" alt="" aria-hidden="true" />
        <p className="landing-eyebrow landing-eyebrow--light">Your table is waiting</p>
        <h2>Think you know football?</h2>
        <p>Make your picks, climb the table and settle it with your mates.</p>
        <StoreBadges placement="final_cta" slideId="landing-footer" />
        <button type="button" onClick={handlePlayOnline}>
          Continue in your browser
        </button>
      </section>
    </main>
  );
}
