/** Which side of the threshold this option represents. */
export type SelectionSide = 'mas' | 'menos';

export type Selection = {
  id: string;
  /** Betting market, e.g. "Anota gol en cualquier momento". */
  market: string;
  /** The chosen selection within the market, e.g. "Mbappé". */
  pick: string;
  odds: number;
  /** Match this selection belongs to (drives the player-prop accordions). */
  matchId: string;
  /** Home team abbreviation, e.g. "PSG". */
  homeAbbrev: string;
  /** Away team abbreviation, e.g. "RMA". */
  awayAbbrev: string;
  /** Kickoff label, e.g. "Hoy 18:00". */
  matchTime: string;
  /** The over/under line this option is measured against, e.g. 0.5. */
  threshold: number;
  /** "mas" (over) or "menos" (under) the threshold. */
  side: SelectionSide;
  /** Shared key for a player's market+threshold pair — Más/Menos under the
      same groupId are mutually exclusive (picking one replaces the other). */
  groupId: string;
};

export type Tier = 0 | 1 | 2 | 3 | 4;

export type TierConfig = {
  id: Tier;
  name: string;
  minOdds: number;
};
