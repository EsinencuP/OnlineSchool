import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { initials } from './format';
export type Tone = 'neutral' | 'blue' | 'teal' | 'yellow' | 'coral' | 'violet' | 'navy';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

const AVATAR_TONES: Tone[] = ['yellow', 'blue', 'teal', 'coral', 'violet'];

export function Avatar({ name, size }: { name: string; size?: 'lg' }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[h % AVATAR_TONES.length]!;
  return (
    <span className={`avatar tone-${tone}${size ? ` avatar-${size}` : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar" role="presentation">
      <i style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <img src="/mascot.svg" alt="" />
      <b style={{ color: 'var(--ink)' }}>{title}</b>
      {text && <span>{text}</span>}
    </div>
  );
}

/** Accessible side panel / dialog: traps initial focus, closes on Escape and backdrop. */
export function Panel({
  title,
  onClose,
  children,
  variant = 'drawer',
  header,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'drawer' | 'modal';
  header?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className={`overlay${variant === 'modal' ? ' center' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={variant}>
        <div className="drawer-head">
          {header}
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Notice({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`notice tone-${tone}`} role="note">
      {icon}
      <div>{children}</div>
    </div>
  );
}
