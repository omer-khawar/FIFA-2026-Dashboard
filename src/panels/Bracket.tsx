/**
 * Bracket.tsx — SVG knockout bracket, R32→R16→QF→SF→Final + 3rd place.
 * Connector elbow lines from ordinal pairing.
 * Placeholders shortened per spec. Live nodes glow.
 */
import { useMemo, type ReactElement } from 'react';
import { useWorldCup } from '../data/store';
import type { Match, Stage } from '../lib/types';

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 112;   // width of a match node (foreignObject)
const NODE_H = 46;    // height of a match node
const COL_GAP = 36;   // horizontal gap between columns
const ROW_GAP = 8;    // vertical gap between nodes in same column
const COL_W  = NODE_W + COL_GAP;
const STAGE_LABEL_H = 20; // height reserved for stage labels at top
const THIRD_OFFSET  = 18; // additional vertical offset for 3rd-place box below SF

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageName(s: Stage | string): string {
  switch (s) {
    case 'r32':   return 'Round of 32';
    case 'r16':   return 'Round of 16';
    case 'qf':    return 'Quarterfinals';
    case 'sf':    return 'Semifinals';
    case 'final': return 'Final';
    case 'third': return '3rd Place';
    default:      return (s as string).toUpperCase();
  }
}

function shortenLabel(label: string): string {
  let m = label.match(/^Group ([A-L]) Winner$/i);
  if (m) return `${m[1]}1`;

  m = label.match(/^Group ([A-L]) 2nd Place$/i);
  if (m) return `${m[1]}2`;

  m = label.match(/^Third Place Group (.+)$/i);
  if (m) {
    const parts = m[1].split('/');
    if (parts.length > 3) return `3rd ${parts[0]}–${parts[parts.length - 1]}`;
    return `3rd ${m[1]}`;
  }

  m = label.match(/^Round of 32 (\d+) Winner$/i);
  if (m) return `W·R32-${m[1]}`;

  m = label.match(/^Round of 16 (\d+) Winner$/i);
  if (m) return `W·R16-${m[1]}`;

  m = label.match(/^Quarterfinal (\d+) Winner$/i);
  if (m) return `W·QF-${m[1]}`;

  m = label.match(/^Semifinal (\d+) Winner$/i);
  if (m) return `W·SF-${m[1]}`;

  return label.slice(0, 10);
}

// ── Slot-source parsing (for connector edges) ─────────────────────────────────

const ROUND_LABEL_TO_STAGE: Record<string, Stage> = {
  'round of 32': 'r32',
  'round of 16': 'r16',
  quarterfinal: 'qf',
  semifinal: 'sf',
};

/**
 * Extract which prior-round match feeds a knockout slot, straight from the feed's
 * "<Round> N Winner" placeholder label. Returns null for group-stage / third-place
 * placeholders and decided teams. Connectors are derived from these — NOT from a
 * 2k-1/2k assumption, because the real FIFA feed pairs e.g. R32 winners 1 & 3 into
 * R16 match 1 (verified against the live ESPN payload).
 */
function sourceOfSlot(slot: Match['home']): { stage: Stage; ordinal: number } | null {
  if (slot.kind !== 'placeholder') return null;
  const m = /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) Winner$/i.exec(
    slot.label.trim(),
  );
  if (!m) return null;
  const stage = ROUND_LABEL_TO_STAGE[m[1].toLowerCase()];
  if (!stage) return null;
  return { stage, ordinal: parseInt(m[2], 10) };
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

const BRACKET_STAGE_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

/** Column index for each stage */
const STAGE_COL: Partial<Record<Stage, number>> = {
  r32: 0, r16: 1, qf: 2, sf: 3, final: 4,
};

/**
 * Given how many nodes are in a column, compute y-centers in a total content height.
 */
function colYCenters(count: number, totalHeight: number): number[] {
  const slotHeight = totalHeight / count;
  return Array.from({ length: count }, (_, i) => i * slotHeight + slotHeight / 2);
}

// ── Single node rendered as foreignObject ────────────────────────────────────

interface NodeSlotInfo {
  flagUrl?: string;
  code: string;
  score?: number;
  isPlaceholder: boolean;
  isWinner: boolean;
  isLoser: boolean;
}

interface NodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  isLive: boolean;
  top: NodeSlotInfo;
  bottom: NodeSlotInfo;
}

function BracketNode({ x, y, w, h, isLive, top, bottom }: NodeProps) {
  const rowH = Math.floor((h - 1) / 2);

  const renderSlot = (slot: NodeSlotInfo, rowHeight: number) => {
    const dimClass = slot.isLoser ? ' wc-bracket-node__row--loser' : '';
    const winClass = slot.isWinner ? ' wc-bracket-node__row--winner' : '';
    return (
      <div
        className={`wc-bracket-node__row${winClass}${dimClass}`}
        style={{ height: rowHeight, minHeight: rowHeight }}
      >
        {slot.isPlaceholder ? (
          <span className="wc-bracket-node__placeholder" title={slot.code}>{slot.code}</span>
        ) : (
          <>
            {slot.flagUrl
              ? <img src={slot.flagUrl} className="wc-bracket-node__flag" alt={slot.code} loading="lazy" />
              : <span style={{ width: 14, flexShrink: 0, display: 'inline-block' }} />
            }
            <span className="wc-bracket-node__code">{slot.code}</span>
            {slot.score !== undefined && (
              <span className="wc-bracket-node__score">{slot.score}</span>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        className={`wc-bracket-node${isLive ? ' wc-bracket-node--live' : ''}`}
        style={{ width: w, height: h }}
      >
        {renderSlot(top, rowH)}
        <div className="wc-bracket-node__divider" />
        {renderSlot(bottom, rowH)}
      </div>
    </foreignObject>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Bracket() {
  // Pull primitive/stable references from the store
  const matches = useWorldCup(s => s.matches);
  const teams   = useWorldCup(s => s.teams);

  // Compute bracket rounds inside useMemo — stable derivation
  const { mainRounds, thirdRound } = useMemo(() => {
    const byStage: Partial<Record<Stage, Match[]>> = {};
    for (const m of matches) {
      if (!byStage[m.stage]) byStage[m.stage] = [];
      byStage[m.stage]!.push(m);
    }
    // Sort each stage by ordinal
    for (const stage of Object.keys(byStage) as Stage[]) {
      byStage[stage]!.sort((a, b) => a.ordinal - b.ordinal);
    }

    const mainRounds = BRACKET_STAGE_ORDER
      .filter(s => (byStage[s]?.length ?? 0) > 0)
      .map(s => ({ stage: s, matches: byStage[s]! }));

    const thirdMatches = byStage['third'] ?? [];
    const thirdRound = thirdMatches.length > 0
      ? { stage: 'third' as Stage, matches: thirdMatches }
      : null;

    return { mainRounds, thirdRound };
  }, [matches]);

  // Layout calculation
  const layout = useMemo(() => {
    if (mainRounds.length === 0) return null;

    const maxCount = Math.max(...mainRounds.map(r => r.matches.length));
    const totalContentH = maxCount * NODE_H + (maxCount - 1) * ROW_GAP;
    const totalH = STAGE_LABEL_H + totalContentH;
    const numCols = mainRounds.length;
    const totalW = numCols * COL_W - COL_GAP;

    const roundLayouts = mainRounds.map(({ stage, matches }) => {
      const colIdx = STAGE_COL[stage] ?? 0;
      const centers = colYCenters(matches.length, totalContentH);
      return { stage, matches, colIdx, centers };
    });

    return { totalW, totalH, roundLayouts };
  }, [mainRounds]);

  // Helper: get x for a column index
  const colX = (colIdx: number) => colIdx * COL_W;

  // Helper: y for a node top-left given its center
  const nodeY = (cy: number) => STAGE_LABEL_H + cy - NODE_H / 2;

  // Helper: build NodeSlotInfo from a match slot
  const slotInfo = (match: Match, side: 'home' | 'away'): NodeSlotInfo => {
    const slot = side === 'home' ? match.home : match.away;
    const score = side === 'home' ? match.homeScore : match.awayScore;

    if (slot.kind === 'team') {
      const team = teams[slot.teamId];
      const isWinner = match.state === 'post'
        && match.winnerTeamId === slot.teamId;
      const isLoser = match.state === 'post'
        && match.winnerTeamId !== undefined
        && match.winnerTeamId !== slot.teamId;
      return {
        flagUrl: team?.flagUrl,
        code: team?.code ?? slot.teamId,
        score,
        isPlaceholder: false,
        isWinner,
        isLoser,
      };
    } else {
      return {
        code: shortenLabel(slot.label),
        score: undefined,
        isPlaceholder: true,
        isWinner: false,
        isLoser: false,
      };
    }
  };

  if (!layout || mainRounds.length === 0) {
    return (
      <div className="card area-bracket">
        <div className="card-label">Bracket</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Bracket data loading…</div>
      </div>
    );
  }

  const { totalW, totalH, roundLayouts } = layout;

  // SVG canvas size — add bottom margin for 3rd-place if it exists
  const svgH = totalH + (thirdRound ? NODE_H + THIRD_OFFSET + 28 : 16);

  // Lookup: (stage, ordinal) → { center y, right-edge x } of that match's node.
  const nodeByStageOrdinal = new Map<string, { cy: number; rightX: number; leftX: number }>();
  for (const { stage, matches: ms, colIdx, centers } of roundLayouts) {
    ms.forEach((m, k) => {
      nodeByStageOrdinal.set(`${stage}#${m.ordinal}`, {
        cy: STAGE_LABEL_H + centers[k],
        rightX: colX(colIdx) + NODE_W,
        leftX: colX(colIdx),
      });
    });
  }

  // Connector lines: for each NEXT-round node, draw an elbow from each prior-round
  // match that feeds it, resolved from the feed's "<Round> N Winner" labels.
  const connectorLines: ReactElement[] = [];
  for (let ri = 1; ri < roundLayouts.length; ri++) {
    const next = roundLayouts[ri];
    const nx = colX(next.colIdx); // left edge of this (parent) column

    next.matches.forEach((m, k) => {
      const py = STAGE_LABEL_H + next.centers[k];
      for (const slot of [m.home, m.away]) {
        const src = sourceOfSlot(slot);
        if (!src) continue;
        const child = nodeByStageOrdinal.get(`${src.stage}#${src.ordinal}`);
        if (!child) continue;
        const cx = child.rightX;
        const cy = child.cy;
        const midX = cx + (nx - cx) / 2;
        connectorLines.push(
          <path
            key={`conn-${next.stage}-${m.ordinal}-${src.stage}-${src.ordinal}`}
            d={`M ${cx} ${cy} H ${midX} V ${py} H ${nx}`}
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinecap="round"
          />,
        );
      }
    });
  }

  // 3rd-place position: below SF column, centered between SF and Final columns
  const sfLayout = roundLayouts.find(r => r.stage === 'sf');
  const finalColIdx = STAGE_COL['final'] ?? 4;
  const sfColIdx = STAGE_COL['sf'] ?? 3;

  const thirdY = sfLayout
    ? STAGE_LABEL_H
      + sfLayout.centers[sfLayout.centers.length - 1]
      + NODE_H / 2
      + THIRD_OFFSET
    : totalH + THIRD_OFFSET;

  const thirdX = colX(sfColIdx)
    + (colX(finalColIdx) - colX(sfColIdx)) / 2
    - NODE_W / 2;

  return (
    <div className="card area-bracket">
      <div className="card-label">Bracket</div>
      <div className="wc-bracket-wrap">
        <svg
          className="wc-bracket-svg"
          width={totalW}
          height={svgH}
          viewBox={`0 0 ${totalW} ${svgH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ fontFamily: 'var(--font)', fontSize: 10, color: 'var(--text)' }}
        >
          {/* Stage labels */}
          {roundLayouts.map(({ stage, colIdx }) => (
            <text
              key={`label-${stage}`}
              x={colX(colIdx) + NODE_W / 2}
              y={4}
              textAnchor="middle"
              className="wc-bracket-stage-label"
            >
              {stageName(stage)}
            </text>
          ))}

          {/* Connector elbow lines (behind nodes) */}
          {connectorLines}

          {/* Match nodes */}
          {roundLayouts.map(({ matches, colIdx, centers }) =>
            matches.map((m, k) => (
              <BracketNode
                key={m.id}
                x={colX(colIdx)}
                y={nodeY(centers[k])}
                w={NODE_W}
                h={NODE_H}
                isLive={m.state === 'in'}
                top={slotInfo(m, 'home')}
                bottom={slotInfo(m, 'away')}
              />
            ))
          )}

          {/* 3rd-place match */}
          {thirdRound && thirdRound.matches.length > 0 && (
            <>
              <text
                x={thirdX + NODE_W / 2}
                y={thirdY - 4}
                textAnchor="middle"
                className="wc-bracket-stage-label"
              >
                3rd Place
              </text>
              <BracketNode
                x={thirdX}
                y={thirdY}
                w={NODE_W}
                h={NODE_H}
                isLive={thirdRound.matches[0].state === 'in'}
                top={slotInfo(thirdRound.matches[0], 'home')}
                bottom={slotInfo(thirdRound.matches[0], 'away')}
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
