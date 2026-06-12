/**
 * NewsRow.tsx — up to 8 news cards, horizontal scroll.
 * 16/9 cover image, 2-line headline, time-ago. Full card is <a>.
 */
import { useWorldCup } from '../data/store';
import { timeAgo } from '../lib/format';

export default function NewsRow() {
  const { news } = useWorldCup();
  const items = news.slice(0, 8);

  return (
    <div className="card area-news" style={{ padding: '12px 16px' }}>
      <div className="card-label">News</div>
      <div className="wc-news-scroll">
        {items.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '4px 0' }}>
            No news available
          </div>
        )}
        {items.map(item => (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="wc-news-card"
            aria-label={item.headline}
          >
            {/* Cover image — always renders the box; shows ⚽ fallback */}
            <div className="wc-news-card__img-wrap">
              {item.imageUrl ? (
                <img
                  className="wc-news-card__img"
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  onError={e => {
                    // Hide broken image; parent div shows fallback bg
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="wc-news-card__no-img" aria-hidden="true">⚽</span>
              )}
            </div>

            <div className="wc-news-card__body">
              <div className="wc-news-card__headline">{item.headline}</div>
              <div className="wc-news-card__time">{timeAgo(item.published)}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
