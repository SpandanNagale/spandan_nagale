import { RESUME_URL } from '../data/projects';

export default function Footer() {
  return (
    <footer className="relative z-10 max-w-6xl mx-auto px-6 py-16 border-t border-line mt-12">
      <p className="text-muted mb-6">
        Open to AI/ML and agentic engineering roles &mdash; remote or relocation.
      </p>
      <div className="flex flex-col gap-2">
        <a href="mailto:spandan4844@gmail.com" className="mono-label text-text w-fit hover:text-flow hover:underline underline-offset-4 decoration-flow">
          spandan4844@gmail.com
        </a>
        <a
          href="https://github.com/SpandanNagale"
          target="_blank"
          rel="noopener noreferrer"
          className="mono-label text-text w-fit hover:text-flow hover:underline underline-offset-4 decoration-flow"
        >
          github.com/SpandanNagale
        </a>
        <a
          href="https://www.linkedin.com/in/spandan-nagale-5a38a3290/"
          target="_blank"
          rel="noopener noreferrer"
          className="mono-label text-text w-fit hover:text-flow hover:underline underline-offset-4 decoration-flow"
        >
          linkedin.com/in/spandan-nagale
        </a>
        <a
          href={RESUME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mono-label text-flow w-fit hover:underline underline-offset-4 decoration-flow"
        >
          VIEW RESUME &rarr;
        </a>
      </div>
    </footer>
  );
}
