export type TeamId = string;                       // ESPN team id
export type Stage = 'group'|'r32'|'r16'|'qf'|'sf'|'third'|'final';
export type MatchState = 'pre'|'in'|'post';

export interface Team { id: TeamId; name: string; code: string; flagUrl: string; groupId?: string; }
export type Slot =
  | { kind: 'team'; teamId: TeamId }
  | { kind: 'placeholder'; label: string };        // raw ESPN placeholder displayName

export interface Match {
  id: string; date: string;                        // ISO
  stage: Stage; group?: string;                    // 'A'..'L' for group stage
  ordinal: number;                                 // 1-based index within its stage, by date then id
  home: Slot; away: Slot;
  homeScore?: number; awayScore?: number;
  homeShootout?: number; awayShootout?: number;
  winnerTeamId?: TeamId;                           // set when post (knockout: incl. pens)
  state: MatchState; statusDetail: string; clock?: string;
  venueId: string; venueName: string; city: string;
}
export interface GroupRow { teamId: TeamId; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number; rank: number; noteColor?: string; noteDesc?: string; }
export interface Group { id: string; rows: GroupRow[]; }          // id: 'A'..'L'
export interface Stadium { venueId: string; name: string; city: string; country: 'USA'|'MEX'|'CAN';
  lat: number; lon: number; capacity: number; }
export interface NewsItem { id: string; headline: string; description: string; published: string;
  imageUrl?: string; link: string; }

export interface MatchProbs { matchId: string; pHome: number; pDraw: number; pAway: number;  // 90'
  pHomeAdvance?: number; }                                        // knockout only
export interface TeamOutlook { teamId: TeamId; pR32: number; pR16: number; pQF: number;
  pSF: number; pFinal: number; pChampion: number; }
export interface Predictions { asOf: string; iterations: number; elo: Record<TeamId, number>;
  matchProbs: Record<string, MatchProbs>; outlooks: Record<TeamId, TeamOutlook>; }
