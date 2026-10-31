import Link from 'next/link';
import { buttonClasses } from '@lingoup/ui';

export function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="status-dot" /> YOUR ENGLISH. NEXT LEVEL.
        </p>
        <h1 id="home-hero-title">
          Small steps.
          <br />A whole new <span>world.</span>
        </h1>
        <p className="hero-description">
          Read something interesting. Find the words you need. Build the confidence to make English
          part of your everyday.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/library" className={buttonClasses('primary', 'lg')}>
            Explore the library <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/grammar" className={buttonClasses('secondary', 'lg')}>
            Practise grammar <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="hero-note">
          <span aria-hidden="true">✓</span> Your pace. Your level. Always open source.
        </p>
      </div>
      <div className="learning-visual" aria-hidden="true">
        <div className="visual-topline">
          <span>LANGUAGE_IN_MOTION</span>
          <span className="text-primary">[ LIVE ]</span>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="orbit-core">
          <span>English</span>
          <strong>
            Aa<span>↗</span>
          </strong>
          <span>A WORLD OF POSSIBILITY</span>
        </div>
        <div className="floating-word word-hello">
          Hello <span>↗</span>
        </div>
        <div className="floating-word word-world">
          <span className="status-dot" /> New perspectives
        </div>
        <div className="visual-bottomline">
          <span>READ · DISCOVER · REMEMBER</span>
          <span>01 — 06</span>
        </div>
      </div>
      <div className="hero-metrics">
        <div>
          <strong>A1–C2</strong>
          <span>EVERY LEVEL WELCOME</span>
        </div>
        <div>
          <strong>6 skills</strong>
          <span>ONE CONNECTED JOURNEY</span>
        </div>
        <div>
          <strong>Your pace</strong>
          <span>PROGRESS THAT STAYS</span>
        </div>
      </div>
    </section>
  );
}
