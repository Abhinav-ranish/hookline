export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 3.4v10.2a5.1 5.1 0 0 1-10.2 0v-2.3l3.3 2.6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.4" cy="5.4" r="2" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <Mark />
      Hookline
    </span>
  );
}

export function ThinkingMark() {
  return (
    <svg className="thinking" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path className="thinking-track" d="M15 3.4v10.2a5.1 5.1 0 0 1-10.2 0v-2.3l3.3 2.6" pathLength="100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path className="thinking-line" d="M15 3.4v10.2a5.1 5.1 0 0 1-10.2 0v-2.3l3.3 2.6" pathLength="100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="thinking-dot" cx="19.4" cy="5.4" r="2" fill="currentColor" />
    </svg>
  );
}
