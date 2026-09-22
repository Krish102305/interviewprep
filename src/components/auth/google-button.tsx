export function GoogleButton({ href, label = "Continue with Google" }: { href: string; label?: string }) {
  return (
    <a href={href} className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white text-sm font-medium text-ink-800 shadow-card transition hover:bg-ink-50">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8Z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4Z" />
      </svg>
      {label}
    </a>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-ink-400">
      <span className="h-px flex-1 bg-ink-200" /> or <span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}
