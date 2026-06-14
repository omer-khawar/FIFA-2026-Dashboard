/**
 * NewsRow.tsx — contextual "RELATED NEWS" feed for the Context Rail (blueprint §1.4 / §3).
 *
 * Prominent, image-led cards (not an afterthought): each card is a fixed ~84px
 * tall row with a larger 96×64 rounded thumbnail (graceful empty-state block), a
 * 2-line clamped headline in body scale, and a time-ago sub-label. The whole card
 * is the outbound <a>. Accepts the already-scored/sorted items as a prop (scoring
 * lives in hud.ts / ContextRail — frozen). Cards are equal height.
 */
import type { NewsItem } from '../lib/types';
import { timeAgo } from '../lib/format';

export function NewsListRow({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={item.headline}
      className="group flex h-[84px] items-center gap-3 rounded-xl border border-hairline bg-white/[0.02] p-2.5 transition-colors hover:border-neon/40 hover:bg-white/[0.05]"
    >
      {/* Thumb 96×64 — larger, image-led */}
      <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.05]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-hud)] group-hover:scale-[1.04]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-dust/40">
            <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8.5" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4 17l4.5-4.5L13 17l3-3 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="line-clamp-2 text-[12px] leading-[1.35] text-chalk/85 transition-colors group-hover:text-chalk">
          {item.headline}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dust">
          {timeAgo(item.published)}
        </span>
      </div>
    </a>
  );
}

export default function NewsRow({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-white/[0.02] px-3 py-5 text-center text-[11px] text-dust">
        No related news right now.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <NewsListRow key={item.id} item={item} />
      ))}
    </div>
  );
}
