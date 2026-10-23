import { RESUME_URL } from '../data/projects';

const LINKS = [
  { href: 'https://github.com/SpandanNagale', label: 'GitHub', external: true },
  { href: 'https://www.linkedin.com/in/spandan-nagale-5a38a3290/', label: 'LinkedIn', external: true },
  { href: 'mailto:spandan4844@gmail.com', label: 'Email', external: false },
  { href: RESUME_URL, label: 'Résumé', external: true },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-line overflow-hidden">
      <div className="dot-texture absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative max-w-[1320px] mx-auto px-4 md:px-6 py-12 md:py-16 flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="flex flex-col gap-2">
            <span className="display text-4xl md:text-5xl text-text">Spandan Nagale</span>
            <span className="mono-label text-muted">AI/ML engineer &middot; Bangalore, India</span>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="text-sm text-text hover:text-flow underline-offset-4 hover:underline"
                >
                  {l.label}
                  {l.external && <span aria-hidden="true"> ↗</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-6">
          <a href="#live" className="mono-label text-muted hover:text-text flex items-center gap-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-flow" aria-hidden="true" />
            All systems operational
          </a>
          <span className="mono-label text-muted">&copy; {new Date().getFullYear()} Spandan Nagale</span>
        </div>
      </div>
    </footer>
  );
}
