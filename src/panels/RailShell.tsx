/**
 * RailShell.tsx — responsive wrapper for the two side rails (blueprint §1.7).
 *
 * Desktop ≥1280px: renders the panel full-size (fills the App's fixed-width rail
 * container). 1000–1279px: collapses to a 48px vertical glass pill of icon
 * buttons; tapping flies the same panel out as an absolute overlay drawer
 * (slide-in 220ms), click-outside closes. <1000px: the rail becomes a bottom
 * sheet behind a single floating toggle (zero-scroll is desktop-scoped — this
 * just must not break). Desktop is the priority.
 *
 * The App shell hard-codes the rail container width and cannot be edited, so at
 * narrow widths the shell root goes pointer-events-none and only the pill/drawer
 * stay interactive, letting the map breathe behind the (now-empty) container.
 */
import { useEffect, useState } from 'react';
import { FLOATING_PANEL } from './DataDeck';

type Bp = 'wide' | 'rail' | 'sheet';

function useBreakpoint(): Bp {
  const get = (): Bp => {
    if (typeof window === 'undefined') return 'wide';
    const w = window.innerWidth;
    if (w >= 1280) return 'wide';
    if (w >= 1000) return 'rail';
    return 'sheet';
  };
  const [bp, setBp] = useState<Bp>(get);
  useEffect(() => {
    const on = () => setBp(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return bp;
}

export interface RailIcon {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export default function RailShell({
  side,
  icons,
  children,
}: {
  side: 'left' | 'right';
  /** Icon buttons for the collapsed pill (decorative quick-glance + open). */
  icons: RailIcon[];
  children: React.ReactNode;
}) {
  const bp = useBreakpoint();
  const [open, setOpen] = useState(false);

  // Reset the drawer whenever we leave a collapsed mode.
  useEffect(() => {
    if (bp === 'wide') setOpen(false);
  }, [bp]);

  // Esc closes the drawer/sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (bp === 'wide') {
    return <>{children}</>;
  }

  const isLeft = side === 'left';

  // Collapsed pill of icon buttons.
  const Pill = (
    <div
      className={`pointer-events-auto absolute top-0 z-10 flex w-12 flex-col items-center gap-1 rounded-2xl border border-hairline bg-glass py-2 backdrop-blur-xl ${
        isLeft ? 'left-0' : 'right-0'
      }`}
    >
      {icons.map((ic) => (
        <button
          key={ic.key}
          onClick={() => setOpen(true)}
          aria-label={ic.label}
          title={ic.label}
          className="grid h-9 w-9 place-items-center rounded-lg text-dust transition-colors hover:bg-white/[0.06] hover:text-neon"
        >
          {ic.icon}
        </button>
      ))}
    </div>
  );

  if (bp === 'rail') {
    return (
      <div className="pointer-events-none absolute inset-0">
        {Pill}
        {open && (
          <>
            {/* click-outside scrim */}
            <div
              className="pointer-events-auto fixed inset-0 z-20 bg-void/40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            {/* flyout drawer — same panel content, slides in */}
            <div
              className={`pointer-events-auto absolute top-0 z-30 h-full w-[340px] ${
                isLeft ? 'left-14' : 'right-14'
              }`}
              style={{ animation: 'hud-rail-in 220ms var(--ease-hud)' }}
            >
              {children}
            </div>
          </>
        )}
      </div>
    );
  }

  // sheet (<1000px): floating toggle → bottom sheet.
  return (
    <div className="pointer-events-none absolute inset-0">
      <button
        onClick={() => setOpen(true)}
        aria-label={icons[0]?.label ?? 'Open panel'}
        className={`pointer-events-auto absolute top-0 z-10 grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-glass text-dust backdrop-blur-xl ${
          isLeft ? 'left-0' : 'right-0'
        }`}
      >
        {icons[0]?.icon}
      </button>
      {open && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-20 bg-void/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`pointer-events-auto fixed inset-x-2 bottom-2 z-30 h-[62vh] overflow-hidden ${FLOATING_PANEL}`}
            style={{ animation: 'hud-sheet-up 280ms var(--ease-hud)' }}
          >
            <div className="h-full">{children}</div>
          </div>
        </>
      )}
    </div>
  );
}
