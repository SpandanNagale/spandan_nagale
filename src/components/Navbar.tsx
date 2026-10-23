import { useEffect, useState } from 'react';
import { RESUME_URL } from '../data/projects';
import { openAssistant } from '../lib/assistant';

const LINKS = [
  { href: '#systems', label: 'Systems' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#live', label: 'Live' },
  { href: '#experience', label: 'Experience' },
  { href: '#contact', label: 'Contact' },
];

const SCROLL_THRESHOLD = 50;

/** Flat at the top of the page; past ~50px it morphs into a floating,
 * centred pill. Below md the links collapse into a menu. */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const floating = scrolled || menuOpen;

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 md:px-6 pointer-events-none">
      <nav
        aria-label="Primary"
        className={`pointer-events-auto mx-auto flex items-center justify-between gap-4 transition-[max-width,margin,padding,background-color,border-color,box-shadow,border-radius] duration-300 ease-out border ${
          floating
            ? 'max-w-[860px] mt-3 px-3 py-2 md:pl-5 rounded-[28px] bg-panel/80 backdrop-blur-md border-line shadow-[0_8px_30px_-12px_rgba(10,10,10,0.18)]'
            : 'max-w-6xl mt-0 px-3 py-5 rounded-none bg-transparent border-transparent'
        }`}
      >
        <a href="#top" className="font-display text-[15px] font-medium tracking-[-0.01em] text-text shrink-0">
          Spandan Nagale
        </a>

        <ul className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-sm text-muted hover:text-text transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <a
            href={RESUME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline text-sm text-text hover:text-flow transition-colors"
          >
            Résumé
          </a>
          <button
            type="button"
            onClick={openAssistant}
            aria-haspopup="dialog"
            className="pill hidden md:inline-flex !py-2.5 !px-4 !text-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-flow-on-ink" aria-hidden="true" />
            Ask about Spandan
          </button>
          <button
            type="button"
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full border border-line bg-panel text-text"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M2 5H14M2 11H14" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="pointer-events-auto md:hidden mx-auto max-w-[860px] mt-2 rounded-3xl border border-line bg-panel/95 backdrop-blur-md p-2 shadow-[0_8px_30px_-12px_rgba(10,10,10,0.18)]"
        >
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-base text-text rounded-2xl hover:bg-void"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={RESUME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 text-base text-text rounded-2xl hover:bg-void"
              >
                Résumé &nearr;
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
