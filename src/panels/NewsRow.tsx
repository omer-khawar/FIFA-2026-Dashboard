/**
 * NewsRow.tsx — stub. Panels agent replaces internals.
 * Up to 8 news cards linking to ESPN articles.
 */
import { useWorldCup } from '../data/store';
import { timeAgo } from '../lib/format';

export default function NewsRow() {
  const { news } = useWorldCup();
  const items = news.slice(0, 8);

  return (
    <div className="card area-news" style={{ padding: '12px 16px' }}>
      <div className="card-label">News</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {items.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>No news available</div>
        )}
        {items.map(item => (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0,
              width: 200,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg1)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              overflow: 'hidden',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.2s',
            }}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                style={{ width: '100%', height: 80, objectFit: 'cover' }}
              />
            )}
            <div style={{ padding: '8px 10px', flex: 1 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 500,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {item.headline}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                {timeAgo(item.published)}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
