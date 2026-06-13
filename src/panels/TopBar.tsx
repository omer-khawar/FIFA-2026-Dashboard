/**
 * TopBar.tsx — SHELL STUB (Phase 1). The panels agent rewrites the internals to
 * the §1.6 lockup + 2px neon progress bar + refresh treatment. For now it wraps
 * the EXISTING <Header/> inside a 52px transparent bar (no card chrome) so the
 * app renders end-to-end. Export name is frozen: default `TopBar`.
 */
import Header from './Header';

export default function TopBar() {
  return (
    <div className="relative z-40 h-[52px] w-full overflow-hidden [&_.card]:!h-full [&_.card]:!rounded-none [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!backdrop-blur-none [&_.card]:!py-0 [&_.card]:flex [&_.card]:items-center">
      <Header />
    </div>
  );
}
