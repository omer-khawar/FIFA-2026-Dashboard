/**
 * NewsRow.tsx — contextual news list for the Context Rail (blueprint §1.4 / §3).
 *
 * Vertical list of compact 64px rows: 56×42 thumb (graceful no-image block),
 * 2-line clamped headline, time-ago. The whole row is the outbound <a>. Accepts
 * the already-scored/sorted items as a prop (scoring lives in hud.ts /
 * ContextRail). The old bottom-of-page news band is gone.
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
      className="group flex h-16 items-center gap-3 rounded-lg border border-transparent px-2 transition-colors hover:border-hairline hover:bg-white/[0.04]"
    >
      {/* Thumb 56×42 */}
      <div className="grid h-[42px] w-[56px] shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.05]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="h-3 w-3 rounded-full border border-dust/40" aria-hidden="true" />
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[12px] leading-[1.35] text-chalk/90 transition-colors group-hover:text-chalk">
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
      <div className="px-2 py-3 text-[11px] text-dust">No news available</div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NewsListRow key={item.id} item={item} />
      ))}
    </div>
  );
}
