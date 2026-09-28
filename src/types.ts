export type Selection = {
  id: string;
  /** Betting market, e.g. "Money line" or "Anota gol en cualquier momento". */
  market: string;
  /** The chosen selection within the market, e.g. "Real Madrid" / "Mbappé". */
  pick: string;
  odds: number;
  /** Match this selection belongs to (drives the match carousel + accordions). */
  matchId: string;
  /** Home team abbreviation, e.g. "PSG". */
  homeAbbrev: string;
  /** Away team abbreviation, e.g. "RMA". */
  awayAbbrev: string;
  /** Kickoff label, e.g. "Hoy 18:00". */
  matchTime: string;
};

export type Tier = 0 | 1 | 2 | 3 | 4;

export type TierConfig = {
  id: Tier;
  name: string;
  minOdds: number;
};
