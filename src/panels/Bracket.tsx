/**
 * Bracket.tsx — full SVG knockout tree (blueprint §3.5, defect 3/6).
 *
 * Restyled for the Theater: transparent node fills, hairline outlines, neon
 * winner ticks, live glow, connectors stroke-white/8. Renders at its intrinsic
 * pixel size (width/height on the <svg>); the Theater wraps it in a transformed
 * group for fit + pan/zoom. The tree itself has no card chrome — the Theater
 * owns the surface.
 *
 * Connector edges are derived from the feed's "<Round> N Winner" labels (NOT a
 * 2k-1/2k assumption) — the real FIFA bracket pairs R32 winners 1 & 3 into R16-1.
 */
import { useMemo, type ReactElement } from 'react';
import { useWorldCup } from '../data/store';
import type { Match, Stage } from '../lib/types';
import { stageName, shortenLabel } from './hud';

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 124;
const NODE_H = 48;
const COL_GAP = 44;
const ROW_GAP = 10;
const COL_W = NODE_W + COL_GAP;
const STAGE_LABEL_H = 26;
const THIRD_OFFSET = 22;

const BRACKET_STAGE_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];
const STAGE_COL: Partial<Record<Stage, number>> = { r32: 0, r16: 1, qf: 2, sf: 3, final: 4 };

const ROUND_LABEL_TO_STAGE: Record<string, Stage> = {
  'round of 32': 'r32',
  'round of 16': 'r16',
  quarterfinal: 'qf',
  semifinal: 'sf',
};

function sourceOfSlot(slot: Match['home']): { stage: Stage; ordinal: number } | null {
  if (slot.kind !== 'placeholder') return null;
  const m = /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) Winner$/i.exec(slot.label.trim());
  if (!m) return null;
  const stage = ROUND_LABEL_TO_STAGE[m[1].toLowerCase()];
  if (!stage) return null;
  return { stage, ordinal: parseInt(m[2], 10) };
}

function colYCenters(count: number, totalHeight: number): number[] {
  const slotHeight = totalHeight / count;
  return Array.from({ length: count }, (_, i) => i * slotHeight + slotHeight / 2);
}

interface NodeSlotInfo {
  flagUrl?: string;
  code: string;
  score?: number;
  isPlaceholder: boolean;
  isWinner: boolean;
  isLoser: boolean;
}

function BracketNode({
  x, y, w, h, isLive, top, bottom,
}: {
  x: number; y: number; w: number; h: number; isLive: boolean;
  top: NodeSlotInfo; bottom: NodeSlotInfo;
}) {
  const rowH = Math.floor((h - 1) / 2);

  const renderSlot = (slot: NodeSlotInfo, rowHeight: number) => (
    <div
      className={`flex items-center gap-1.5 px-2 ${slot.isLoser ? 'opacity-50' : ''}`}
      style={{ height: rowHeight, minHeight: rowHeight }}
    >
      {/* neon winner tick */}
      <span
        className={`h-3 w-[2px] shrink-0 rounded-full ${slot.isWinner ? 'bg-neon' : 'bg-transparent'}`}
      />
      {slot.isPlaceholder ? (
        <span className="truncate text-[10px] italic text-dust/60" title={slot.code}>{slot.code}</span>
      ) : (
        <>
          {slot.flagUrl ? (
            <img src={slot.flagUrl} alt="" loading="lazy" className="h-[11px] w-[16px] rounded-[1px] object-cover" />
          ) : (
            <span className="h-[11px] w-[16px] rounded-[1px] bg-white/[0.06]" />
          )}
          <span className={`min-w-0 flex-1 truncate font-display text-[12px] ${slot.isWinner ? 'font-bold text-chalk' : 'text-chalk/80'}`}>
            {slot.code}
          </span>
          {slot.score !== undefined && (
            <span className="font-display text-[12px] font-bold tabular-nums text-chalk/90">{slot.score}</span>
          )}
        </>
      )}
    </div>
  );

  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        className={`flex flex-col overflow-hidden rounded-md border bg-white/[0.02] ${
          isLive
            ? 'border-live/60 shadow-[0_0_12px_-2px_rgb(255_70_85/0.7)]'
            : 'border-hairline'
        }`}
        style={{ width: w, height: h }}
      >
        {renderSlot(top, rowH)}
        <div className="h-px bg-hairline" />
        {renderSlot(bottom, rowH)}
      </div>
    </foreignObject>
  );
}

export default function Bracket() {
  const matches = useWorldCup((s) => s.matches);
  const teams = useWorldCup((s) => s.teams);

  const { mainRounds, thirdRound } = useMemo(() => {
    const byStage: Partial<Record<Stage, Match[]>> = {};
    for (const m of matches) {
      (byStage[m.stage] ??= []).push(m);
    }
    for (const stage of Object.keys(byStage) as Stage[]) {
      byStage[stage]!.sort((a, b) => a.ordinal - b.ordinal);
    }
    const mainRounds = BRACKET_STAGE_ORDER
      .filter((s) => (byStage[s]?.length ?? 0) > 0)
      .map((s) => ({ stage: s, matches: byStage[s]! }));
    const thirdMatches = byStage['third'] ?? [];
    const thirdRound = thirdMatches.length > 0 ? { stage: 'third' as Stage, matches: thirdMatches } : null;
    return { mainRounds, thirdRound };
  }, [matches]);

  const layout = useMemo(() => {
    if (mainRounds.length === 0) return null;
    const maxCount = Math.max(...mainRounds.map((r) => r.matches.length));
    const totalContentH = maxCount * NODE_H + (maxCount - 1) * ROW_GAP;
    const totalH = STAGE_LABEL_H + totalContentH;
    const numCols = mainRounds.length;
    const totalW = numCols * COL_W - COL_GAP;
    const roundLayouts = mainRounds.map(({ stage, matches }) => ({
      stage,
      matches,
      colIdx: STAGE_COL[stage] ?? 0,
      centers: colYCenters(matches.length, totalContentH),
    }));
    return { totalW, totalH, roundLayouts };
  }, [mainRounds]);

  const colX = (colIdx: number) => colIdx * COL_W;
  const nodeY = (cy: number) => STAGE_LABEL_H + cy - NODE_H / 2;

  const slotInfo = (match: Match, side: 'home' | 'away'): NodeSlotInfo => {
    const slot = side === 'home' ? match.home : match.away;
    const score = side === 'home' ? match.homeScore : match.awayScore;
    if (slot.kind === 'team') {
      const team = teams[slot.teamId];
      const isWinner = match.state === 'post' && match.winnerTeamId === slot.teamId;
      const isLoser = match.state === 'post' && match.winnerTeamId !== undefined && match.winnerTeamId !== slot.teamId;
      return { flagUrl: team?.flagUrl, code: team?.code ?? slot.teamId, score, isPlaceholder: false, isWinner, isLoser };
    }
    return { code: shortenLabel(slot.label), isPlaceholder: true, isWinner: false, isLoser: false };
  };

  if (!layout || mainRounds.length === 0) {
    return <div className="p-4 text-[12px] text-dust">Bracket data loading…</div>;
  }

  const { totalW, totalH, roundLayouts } = layout;
  const svgH = totalH + (thirdRound ? NODE_H + THIRD_OFFSET + 28 : 16);

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

  const connectorLines: ReactElement[] = [];
  for (let ri = 1; ri < roundLayouts.length; ri++) {
    const next = roundLayouts[ri];
    const nx = colX(next.colIdx);
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
        const live = m.state === 'in';
        connectorLines.push(
          <path
            key={`conn-${next.stage}-${m.ordinal}-${src.stage}-${src.ordinal}`}
            d={`M ${cx} ${cy} H ${midX} V ${py} H ${nx}`}
            fill="none"
            stroke={live ? 'var(--color-live)' : 'rgb(255 255 255 / 0.08)'}
            strokeWidth={live ? 1.5 : 1}
            strokeLinecap="round"
          />,
        );
      }
    });
  }

  const sfLayout = roundLayouts.find((r) => r.stage === 'sf');
  const finalColIdx = STAGE_COL['final'] ?? 4;
  const sfColIdx = STAGE_COL['sf'] ?? 3;
  const thirdY = sfLayout
    ? STAGE_LABEL_H + sfLayout.centers[sfLayout.centers.length - 1] + NODE_H / 2 + THIRD_OFFSET
    : totalH + THIRD_OFFSET;
  const thirdX = colX(sfColIdx) + (colX(finalColIdx) - colX(sfColIdx)) / 2 - NODE_W / 2;

  return (
    <svg
      width={totalW}
      height={svgH}
      viewBox={`0 0 ${totalW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Stage labels */}
      {roundLayouts.map(({ stage, colIdx }) => (
        <text
          key={`label-${stage}`}
          x={colX(colIdx) + NODE_W / 2}
          y={6}
          textAnchor="middle"
          fill="var(--color-dust)"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            dominantBaseline: 'hanging',
          }}
        >
          {stageName(stage)}
        </text>
      ))}

      {connectorLines}

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
        )),
      )}

      {thirdRound && thirdRound.matches.length > 0 && (
        <>
          <text
            x={thirdX + NODE_W / 2}
            y={thirdY - 6}
            textAnchor="middle"
            fill="var(--color-dust)"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              dominantBaseline: 'hanging',
            }}
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
  );
}
