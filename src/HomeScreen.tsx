import { memo, useEffect, useRef, useState } from 'react';
import type { BindPick } from './oneClickBetSession';
import arrowNarrowDownIcon from './assets/arrow-narrow-down.svg';
import arrowNarrowUpIcon from './assets/arrow-narrow-up.svg';
import betsIcon from './assets/bets.svg';
import chevronIcon from './assets/chevron.svg';
import gamingIcon from './assets/gaming.svg';
import logoDrafteaIcon from './assets/logo-draftea.svg';
import misEntradasIcon from './assets/mis_entradas.svg';
import playerIcon from './assets/player.svg';
import plusIcon from './assets/plus.svg';
import popularIcon from './assets/popular.svg';
import rewardsIcon from './assets/rewards.png';
import searchIcon from './assets/search.svg';
import statsIcon from './assets/stats.svg';
import userIcon from './assets/user.svg';
import type { Selection } from './types';

/* ============================================================ */
/*  Match + pick data — the sports offering this prototype shows. */
/*  FOUR matches feed the match carousel; each pick carries its   */
/*  match's metadata (matchId/abbrevs/kickoff) so the carousel     */
/*  and the two player-prop accordions (goals, shots) can read it   */
/*  directly instead of a separate lookup table. Higher-odds player  */
/*  entries on PSG-RMA are additional Anota-gol variants used to      */
/*  reach the upper tiers; they carry the same market/name, only       */
/*  odds differ.                                                        */
/* ============================================================ */
export const GOALS_MARKET = 'Anota gol en cualquier momento';
export const SHOTS_MARKET = 'Tiros al arco';

export type MatchInfo = {
  matchId: string;
  league: string;
  homeName: string;
  awayName: string;
  homeAbbrev: string;
  awayAbbrev: string;
  matchTime: string;
};

export const MATCHES: MatchInfo[] = [
  { matchId: 'psg-rma', league: 'Champions', homeName: 'Paris-Saint Germain', awayName: 'Real Madrid', homeAbbrev: 'PSG', awayAbbrev: 'RMA', matchTime: 'Hoy 18:00' },
  { matchId: 'ars-rma', league: 'Champions', homeName: 'Arsenal', awayName: 'Real Madrid', homeAbbrev: 'ARS', awayAbbrev: 'RMA', matchTime: 'Hoy 20:00' },
  { matchId: 'fcb-psg', league: 'Champions', homeName: 'Barcelona', awayName: 'Paris-Saint Germain', homeAbbrev: 'FCB', awayAbbrev: 'PSG', matchTime: 'Mañana 21:00' },
  { matchId: 'liv-mci', league: 'Premier', homeName: 'Liverpool', awayName: 'Manchester City', homeAbbrev: 'LIV', awayAbbrev: 'MCI', matchTime: 'Mañana 14:00' },
];

// Only the match fields carried by each Selection (league/full names live in MATCHES).
const matchOf = (m: MatchInfo) => ({
  matchId: m.matchId,
  homeAbbrev: m.homeAbbrev,
  awayAbbrev: m.awayAbbrev,
  matchTime: m.matchTime,
});
const [M_PSG_RMA, M_ARS_RMA, M_FCB_PSG, M_LIV_MCI] = MATCHES.map(matchOf);
type MatchFields = ReturnType<typeof matchOf>;

/** One player-prop entry as authored in the table below. Omit `mas`/`menos`
    to leave that side out of the card entirely (see the mix of
    Más-only / Menos-only / both configurations across the mock players). */
type PlayerPropInput = {
  /** Slug unique within this match+market, e.g. "mbappe". */
  id: string;
  /** Display name, e.g. "Mbappé". */
  pick: string;
  mas?: number;
  menos?: number;
};

// Builds both Selection rows (Más/Menos) for each player in `entries`, all
// sharing one `groupId` per player so the two sides stay mutually exclusive.
function playerProps(
  match: MatchFields,
  marketSlug: 'goals' | 'shots',
  marketLabel: string,
  threshold: number,
  entries: PlayerPropInput[],
): Selection[] {
  const out: Selection[] = [];
  for (const e of entries) {
    const groupId = `${match.matchId}-${marketSlug}-${e.id}-${threshold}`;
    if (e.mas !== undefined) {
      out.push({
        id: `${groupId}-mas`,
        market: marketLabel,
        pick: e.pick,
        odds: e.mas,
        threshold,
        side: 'mas',
        groupId,
        ...match,
      });
    }
    if (e.menos !== undefined) {
      out.push({
        id: `${groupId}-menos`,
        market: marketLabel,
        pick: e.pick,
        odds: e.menos,
        threshold,
        side: 'menos',
        groupId,
        ...match,
      });
    }
  }
  return out;
}

// Deliberate mix per player: some carry only `mas` (Más), some only `menos`
// (Menos), some both — so the feed shows every configuration the card must
// support.
export const MOCK_PICKS: Selection[] = [
  // ===== Paris-Saint Germain vs Real Madrid =====
  ...playerProps(M_PSG_RMA, 'goals', GOALS_MARKET, 0.5, [
    { id: 'mbappe', pick: 'Mbappé', mas: 1.65, menos: 2.2 },
    { id: 'lewa', pick: 'Lewandowski', mas: 1.95 },
    { id: 'vini', pick: 'Vinicius', menos: 1.75 },
  ]),
  ...playerProps(M_PSG_RMA, 'shots', SHOTS_MARKET, 1.5, [
    { id: 'mbappe', pick: 'Mbappé', mas: 1.55, menos: 2.4 },
    { id: 'vini', pick: 'Vinicius', mas: 1.8 },
    { id: 'lewa', pick: 'Lewandowski', menos: 1.9 },
  ]),
  // ===== Arsenal vs Real Madrid =====
  ...playerProps(M_ARS_RMA, 'goals', GOALS_MARKET, 0.5, [
    { id: 'saka', pick: 'Saka', mas: 2.6, menos: 1.5 },
    { id: 'odegaard', pick: 'Ødegaard', mas: 3.1 },
  ]),
  ...playerProps(M_ARS_RMA, 'shots', SHOTS_MARKET, 1.5, [
    { id: 'saka', pick: 'Saka', mas: 1.9 },
  ]),
  // ===== Barcelona vs PSG =====
  ...playerProps(M_FCB_PSG, 'goals', GOALS_MARKET, 0.5, [
    { id: 'yamal', pick: 'Yamal', mas: 2.2, menos: 1.6 },
    { id: 'mbappe', pick: 'Mbappé', mas: 1.9 },
  ]),
  ...playerProps(M_FCB_PSG, 'shots', SHOTS_MARKET, 1.5, [
    { id: 'yamal', pick: 'Yamal', menos: 1.75 },
  ]),
  // ===== Liverpool vs Man City =====
  ...playerProps(M_LIV_MCI, 'goals', GOALS_MARKET, 0.5, [
    { id: 'salah', pick: 'Salah', menos: 2.0 },
    { id: 'haaland', pick: 'Haaland', mas: 1.7, menos: 2.3 },
  ]),
  ...playerProps(M_LIV_MCI, 'shots', SHOTS_MARKET, 1.5, [
    { id: 'haaland', pick: 'Haaland', mas: 1.6, menos: 2.1 },
  ]),
];

/* ============================================================ */
/*  Header — Draftea logo, balance, lightning, profile          */
/* ============================================================ */
function Header() {
  // Figma "header" node 1665:42931. Three regions:
  //   • Left: Draftea wordmark logo (110×24).
  //   • Right gap-2:
  //     - Balance pair: "$0.00" + "BALANCE" stacked right-aligned,
  //       then a 32×32 purple-gradient circle with the + icon.
  //     - 36×36 circular user button on rgba(251,251,251,0.12) bg.
  return (
    <div className="flex w-full items-center justify-between px-3 py-1">
      {/* Left — Draftea logo */}
      <div className="flex flex-1 items-center">
        <img
          src={logoDrafteaIcon}
          alt="Draftea"
          className="h-6"
        />
      </div>

      {/* Right — balance + plus button + user button */}
      <div className="flex h-full items-center justify-end gap-2">
        {/* Balance pair (text + plus button) */}
        <div className="flex items-center justify-end gap-2 rounded-xl">
          <div className="flex flex-col items-end whitespace-nowrap">
            <span
              className="text-center text-[14px] font-bold leading-[21px] text-[#fbfbfb]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              $0.00
            </span>
            <span
              className="text-right text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              BALANCE
            </span>
          </div>
          {/* Plus button — 32×32 purple gradient (75.11° angle) with
              the standard inset shadow used on the Gana CTA. */}
          <button
            type="button"
            aria-label="Add funds"
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-[56px] active:scale-[0.95] transition-transform"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[56px]"
              style={{
                backgroundImage:
                  'linear-gradient(75.11deg, #4b20ff 0%, #9730ff 100%)',
              }}
            />
            <img
              src={plusIcon}
              alt=""
              aria-hidden
              className="relative h-[18px] w-[18px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.24)',
              }}
            />
          </button>
        </div>

        {/* User / profile button — 36×36 on faint white bg */}
        <button
          type="button"
          aria-label="Profile"
          className="flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-[56px] bg-[rgba(251,251,251,0.12)] px-2 py-2.5 active:scale-[0.95] transition-transform"
        >
          <img
            src={userIcon}
            alt=""
            aria-hidden
            className="h-[18px] w-[18px]"
          />
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Leagues row — Figma node 1665:42976                         */
/*  Horizontal scroll of league/sport icon buttons. Selected     */
/*  league has a #4b20ff 2px ring + transparent purple gradient. */
/*  Bottom border on the row + right-edge fade-to-black gradient.*/
/*  Icons reuse the existing emoji glyphs.                       */
/* ============================================================ */
function LeaguesTab() {
  const [activeLeague, setActiveLeague] = useState<string>('todofut');
  const leagues = [
    { id: 'todofut', label: 'TODO FUT', glyph: '⚽' },
    { id: 'champ', label: 'CHAMPIONS', glyph: '🏆' },
    { id: 'nfl', label: 'NFL', glyph: '🏈' },
    { id: 'mlb', label: 'MLB', glyph: '⚾' },
    { id: 'tenis', label: 'TENIS', glyph: '🎾' },
    { id: 'prem', label: 'PREMIER', glyph: '🦁' },
  ];
  return (
    <div className="relative w-full border-b border-[rgba(251,251,251,0.12)]">
      <div className="no-scrollbar flex w-full items-center gap-3 overflow-x-auto px-3 pt-2">
        {leagues.map((l) => {
          const isActive = activeLeague === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveLeague(l.id)}
              className="flex h-[70px] shrink-0 cursor-pointer flex-col items-center active:scale-[0.96] transition-transform"
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex size-11 items-center justify-center rounded-full text-[22px] leading-none ${
                    isActive
                      ? 'border-2 border-[#4b20ff]'
                      : 'border border-[rgba(251,251,251,0.16)]'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundImage:
                            'linear-gradient(75.11deg, rgba(75,32,255,0.24) 0%, rgba(151,48,255,0.24) 100%)',
                        }
                      : undefined
                  }
                >
                  {l.glyph}
                </div>
                <span
                  className={`w-[52px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] font-bold leading-[15px] ${
                    isActive ? 'text-[#fbfbfb]' : 'text-[rgba(251,251,251,0.5)]'
                  }`}
                  style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                >
                  {l.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {/* Right-edge fade-to-black so trailing tabs hint at more content */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-6"
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, #000 100%)',
        }}
      />
    </div>
  );
}

/* ============================================================ */
/*  Match tabs row — Figma node 1664:42888                      */
/*  Horizontal scroll: a "TODOS" gradient pill (selected) +     */
/*  a series of two-line tabs (HOME vs AWAY / HOY (time)).      */
/* ============================================================ */
function MatchTabsRow() {
  const [activeMatch, setActiveMatch] = useState<string>('todos');
  const matchTabs: Array<
    | { id: 'todos' }
    | { id: string; home: string; away: string; date: string; time: string }
  > = [
    { id: 'todos' },
    { id: 'ars-rma', home: 'ARS', away: 'RMA', date: 'HOY', time: '00:00' },
    { id: 'fcb-psg', home: 'FCB', away: 'PSG', date: 'HOY', time: '00:00' },
    { id: 'abc-xyz-1', home: 'ABC', away: 'XYZ', date: 'HOY', time: '00:00' },
    { id: 'abc-xyz-2', home: 'ABC', away: 'XYZ', date: 'HOY', time: '00:00' },
  ];

  return (
    <div className="flex w-full flex-col items-start px-3">
      <div className="no-scrollbar flex w-full items-center gap-3 overflow-x-auto pb-1 pr-3 pt-2">
        {matchTabs.map((t) => {
          const isTodos = t.id === 'todos';
          const isActive = activeMatch === t.id;
          if (isTodos) {
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveMatch(t.id)}
                className="relative flex h-5 shrink-0 cursor-pointer items-center justify-center rounded-[56px] px-1.5 text-[12px] font-bold leading-[18px] text-[#fbfbfb] active:scale-[0.96] transition-transform"
                style={{
                  backgroundImage:
                    'linear-gradient(53.34deg, #4b20ff 0%, #9730ff 100%)',
                  fontFamily: 'Red Hat Display, sans-serif',
                }}
              >
                TODOS
                {/* TODO: small 10×3 arrow notch below the pill —
                    awaiting asset (imgArrow in the Figma export). */}
              </button>
            );
          }
          // Two-line match tab (teams + date/time).
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveMatch(t.id)}
              className={`flex min-h-[40px] shrink-0 cursor-pointer flex-col items-center justify-center active:scale-[0.96] transition-transform ${
                isActive ? 'opacity-100' : 'opacity-100'
              }`}
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              <div className="flex items-baseline justify-center gap-0.5 text-[12px] font-bold leading-[18px] text-[rgba(251,251,251,0.5)]">
                <span>{t.home}</span>
                <span>vs</span>
                <span>{t.away}</span>
              </div>
              <span className="whitespace-nowrap text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
                {t.date} ({t.time})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Pills row — Figma node 1665:43054                           */
/*  4 chip-style pills with one selected (POPULARES) showing a  */
/*  transparent purple gradient + #4b20ff border + flame icon.  */
/* ============================================================ */
function TabsAndPills() {
  const [activePill, setActivePill] = useState<string>('POPULARES');
  const pills = ['POPULARES', 'TIROS', 'GOLES', 'OTROS'];

  return (
    <div className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto px-3 pt-1">
      {pills.map((label) => {
        const isActive = activePill === label;
        if (isActive) {
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActivePill(label)}
              className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[56px] border border-[#4b20ff] py-[7px] pl-2 pr-3 transition-transform active:scale-[0.96]"
              style={{
                backgroundImage:
                  'linear-gradient(46.31deg, rgba(75,32,255,0.24) 0%, rgba(151,48,255,0.24) 100%)',
              }}
            >
              {/* "Popular" icon — 16×16, anchored to the left of the
                  selected pill (Figma node 1665:43054). */}
              <img
                src={popularIcon}
                alt=""
                aria-hidden
                className="h-4 w-4 shrink-0"
              />
              <span
                className="whitespace-nowrap text-center text-[12px] font-bold leading-[18px] text-[#fbfbfb]"
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {label}
              </span>
            </button>
          );
        }
        // Default (unselected) pill.
        return (
          <button
            key={label}
            type="button"
            onClick={() => setActivePill(label)}
            className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[rgba(251,251,251,0.08)] px-3 py-[7px] transition-transform active:scale-[0.96]"
          >
            <span
              className="whitespace-nowrap text-center text-[12px] font-bold leading-[18px] text-[rgba(251,251,251,0.7)]"
              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Market accordion — Figma "marketAccordeon" node 1628:42604  */
/*  2×2 grid of player-prop cards. Each card has the player's   */
/*  silhouette (player.svg), name + position, match info, stats */
/*  icon, and an odds button at the bottom that toggles the     */
/*  corresponding pick into the bet slip. Selected state uses   */
/*  the lime-cyan gradient for the selected Más/Menos control.  */
/*                                                              */
/*  Parameterized by `title` (the market name); filters `picks`  */
/*  to that market across every match on the feed, reading each   */
/*  card's metadata straight off the Selection (homeAbbrev/         */
/*  awayAbbrev/matchTime) instead of a separate lookup table —        */
/*  rendered twice by HomeScreenChrome (goals + shots markets).        */
/* ============================================================ */
type MarketProps = {
  /** Market name — also the accordion title. Picks are filtered to this. */
  title: string;
  picks: Selection[];
  selectedIds: Set<string>;
  bindPick: BindPick;
  cancelActivePress: () => void;
};

// Position shown next to the player name on each card (default DEL).
const PLAYER_POSITION: Record<string, string> = {
  Ødegaard: 'MED',
};

// Split a "Hoy 18:00" / "Mañana 21:00" kickoff into an uppercase date + a
// time, for the two-line stamp in each card's top-right corner.
function splitKickoff(matchTime: string): { date: string; time: string } {
  const [date, ...rest] = matchTime.split(' ');
  return { date: date.toUpperCase(), time: rest.join(' ') };
}

/** One player's card worth of data: the shared match/threshold context plus
    whichever of Más/Menos this player carries (see MOCK_PICKS — some players
    only have one side, some have both). Grouped by `groupId` so the pair
    renders as ONE card with up to two selection controls. */
type PlayerGroup = {
  groupId: string;
  pick: string;
  threshold: number;
  matchTime: string;
  homeAbbrev: string;
  awayAbbrev: string;
  mas?: Selection;
  menos?: Selection;
};

function groupPlayerPicks(picks: Selection[], market: string): PlayerGroup[] {
  const byGroup = new Map<string, PlayerGroup>();
  for (const p of picks) {
    if (p.market !== market) continue;
    let group = byGroup.get(p.groupId);
    if (!group) {
      group = {
        groupId: p.groupId,
        pick: p.pick,
        threshold: p.threshold,
        matchTime: p.matchTime,
        homeAbbrev: p.homeAbbrev,
        awayAbbrev: p.awayAbbrev,
      };
      byGroup.set(p.groupId, group);
    }
    if (p.side === 'mas') group.mas = p;
    else group.menos = p;
  }
  return [...byGroup.values()];
}

function MarketAccordion({
  title,
  picks,
  selectedIds,
  bindPick,
  cancelActivePress,
}: MarketProps) {
  const [isOpen, setIsOpen] = useState(true);
  // Player-prop cards for THIS market only, across every match on the feed —
  // one entry per player, each carrying whichever Más/Menos options it has.
  const playerGroups = groupPlayerPicks(picks, title);

  // Collapsing the accordion unmounts the player cards below — the
  // selection being held becomes unavailable, so cancel any in-flight
  // Quick Bet hold instead of leaving its timer/rAF loop dangling.
  useEffect(() => {
    if (!isOpen) cancelActivePress();
  }, [isOpen, cancelActivePress]);

  return (
    <div className="w-full border-b border-[rgba(251,251,251,0.12)] bg-black px-3 pb-3">
      {/* Header — clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-11 w-full cursor-pointer items-center py-2.5"
        aria-expanded={isOpen}
      >
        <div className="flex flex-1 items-center gap-1">
          <p
            className="text-left text-[14px] font-bold leading-[21px] text-[#fbfbfb]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {title}
          </p>
        </div>
        <div className="ml-6 flex size-6 shrink-0 items-center justify-center rounded-full border border-[rgba(251,251,251,0.24)]">
          <img
            src={chevronIcon}
            alt=""
            aria-hidden
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </div>
      </button>

      {/* Body — 2×2 grid of player-prop cards + Ver todos CTA */}
      {isOpen && (
        <div className="flex flex-col gap-1 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {playerGroups.map((g) => {
              const { date, time } = splitKickoff(g.matchTime);
              const position = PLAYER_POSITION[g.pick] ?? 'DEL';
              // Labeled selection controls — Más/Menos of the same
              // market+threshold are mutually exclusive (enforced by
              // App.tsx's togglePick via `groupId`); tapping the selected
              // one deselects it instead of toggling to the other.
              const options = [
                g.mas && { key: 'mas' as const, label: 'Más', sel: g.mas },
                g.menos && { key: 'menos' as const, label: 'Menos', sel: g.menos },
              ].filter((o): o is { key: 'mas' | 'menos'; label: string; sel: Selection } => Boolean(o));
              return (
                <div
                  key={g.groupId}
                  className="relative flex flex-col items-center gap-2 overflow-hidden rounded-[20px] border border-[rgba(251,251,251,0.12)] bg-black p-2.5"
                >
                  {/* TODO: decorative "light" glow at top of card —
                      Figma uses imgLight (no asset uploaded). */}

                  {/* Top-left: stats icon (chart bars) */}
                  <div className="absolute left-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.12)] p-0.5 backdrop-blur-sm">
                    <img
                      src={statsIcon}
                      alt=""
                      aria-hidden
                      className="h-3 w-3"
                    />
                  </div>

                  {/* Top-right: match teams + date + time */}
                  <div className="absolute right-2.5 top-2.5 z-10 flex flex-col items-end">
                    <div
                      className="flex items-baseline gap-px text-[10px] leading-[15px]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      <span className="font-medium text-[rgba(251,251,251,0.7)]">
                        {g.homeAbbrev}
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        vs
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        {g.awayAbbrev}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {date}
                    </span>
                    <span
                      className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {time}
                    </span>
                  </div>

                  {/* Player image + name + position.
                      The gradient fade sits ABOVE the bottom of the
                      silhouette (covering shoulders/chest) and EXTENDS
                      DOWN behind the player name, so the head reads
                      crisp and the name floats over a black wash. */}
                  <div className="relative flex w-full flex-col items-center pt-2">
                    <img
                      src={playerIcon}
                      alt=""
                      aria-hidden
                      className="relative z-0"
                      width={76}
                      height={76}
                    />
                    {/* Fade — 60px tall, ~140px wide, anchored to the
                        bottom of the player container. Starts halfway
                        down the silhouette, ends just past the name. */}
                    <div
                      className="pointer-events-none absolute bottom-0 left-1/2 z-[1] h-[60px] w-[140px] -translate-x-1/2 bg-gradient-to-b from-transparent to-black"
                      aria-hidden
                    />
                    <div
                      className="relative z-[2] flex items-baseline justify-center gap-0.5"
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      <span className="text-[14px] font-medium leading-[21px] text-[#fbfbfb]">
                        {g.pick}
                      </span>
                      <span className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]">
                        {position}
                      </span>
                    </div>
                  </div>

                  {/* Selection controls — Figma "playerProps" (20216:22083):
                      MÁS/MENOS label on top, arrow icon + line value below.
                      No odds are shown. When both sides exist they join into
                      one pill (1.5px hairline gap, only the outer corners
                      rounded); a single side keeps all four corners rounded.
                      Hold progress renders only in the floating pill
                      (OneClickBetPill.tsx) — these stay `qb-hold` only for
                      the touch-action rule. */}
                  <div className="flex h-11 w-full items-center gap-[1.5px]">
                    {options.map(({ key, label, sel }, i) => {
                      const selected = selectedIds.has(sel.id);
                      const corners =
                        options.length === 1
                          ? 'rounded-xl'
                          : i === 0
                            ? 'rounded-l-xl'
                            : 'rounded-r-xl';
                      return (
                        <button
                          key={key}
                          type="button"
                          {...bindPick(sel)}
                          aria-pressed={selected}
                          className={`qb-hold qb-press flex h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden border px-2 py-1 transition-all duration-200 active:scale-[0.96] ${corners} ${
                            selected
                              ? 'border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)]'
                              : 'border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.12)]'
                          }`}
                        >
                          <span
                            className="whitespace-nowrap text-center text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]"
                            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                          >
                            {label.toUpperCase()}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <img
                              src={key === 'mas' ? arrowNarrowUpIcon : arrowNarrowDownIcon}
                              alt=""
                              aria-hidden
                              className="h-3 w-3"
                            />
                            <span
                              className={`whitespace-nowrap text-center text-[14px] leading-[21px] text-[#fbfbfb] ${
                                selected ? 'font-bold' : 'font-medium'
                              }`}
                              style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                            >
                              {g.threshold}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ver todos (N) — tertiary CTA */}
          <button
            type="button"
            className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 py-2 text-[14px] font-medium leading-[21px] text-[#fbfbfb] transition-opacity hover:opacity-80"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            Ver todos ({playerGroups.length})
            <img
              src={chevronIcon}
              alt=""
              aria-hidden
              className="h-4 w-4"
            />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/*  Bottom navbar (Figma "navbar and search" node 1628:42603)   */
/*  4 tabs (Bets default-selected) + dedicated search button.   */
/*  Icons sourced from src/assets/ by name-matching the tab id. */
/* ============================================================ */
function NavbarImpl({
  entryCount = 0,
  bump = 0,
  badgeVisible = false,
  compact = false,
}: {
  entryCount?: number;
  bump?: number;
  badgeVisible?: boolean;
  /** Scrolled-down state: drop the labels + shrink the bar to a single
      row of icons (Figma 33885:39455). Morphs smoothly via CSS. */
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'bets' | 'entradas' | 'gaming' | 'rewards'>('bets');

  // Entry-count badge lifecycle. `shouldShow` follows App's 10s window;
  // `badgeMounted` lags it so the badge can fade out (opacity transition)
  // before it unmounts, instead of popping out of existence. Deterministic
  // (no AnimatePresence), so there's no exit-race flicker.
  const shouldShowBadge = badgeVisible && entryCount > 0;
  const [badgeMounted, setBadgeMounted] = useState(false);
  useEffect(() => {
    if (shouldShowBadge) {
      setBadgeMounted(true);
      return;
    }
    const t = setTimeout(() => setBadgeMounted(false), 250); // after fade-out
    return () => clearTimeout(t);
  }, [shouldShowBadge]);

  const tabs: Array<{
    id: 'bets' | 'entradas' | 'gaming' | 'rewards';
    label: string;
    icon: string | null;
  }> = [
    { id: 'bets', label: 'Bets', icon: betsIcon },
    { id: 'entradas', label: 'Mis entradas', icon: misEntradasIcon },
    { id: 'gaming', label: 'Gaming', icon: gamingIcon },
    { id: 'rewards', label: 'Rewards', icon: rewardsIcon },
  ];

  return (
    <div
      className={`mx-auto flex items-center justify-center gap-2 pb-4 transition-[width,padding] duration-[250ms] ease-out ${
        compact ? 'w-[248px] px-0' : 'w-full px-4'
      }`}
    >
      {/* Tab pill — 4 tabs in a single rounded container. Compact (scrolled
          down, Figma 33885:39456): height 58→40px, padding 6→4px. Stays
          flex-1, so within the 248px centered bar (− 8px gap − 40px search)
          it lands at exactly 200px wide, icon-only. */}
      <div
        className={`flex flex-1 items-center justify-center rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-[height,padding] duration-[250ms] ease-out ${
          compact ? 'h-10 p-1' : 'h-[58px] p-1.5'
        }`}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tab={t.id === 'entradas' ? 'entradas' : undefined}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex h-full min-w-px flex-[1_0_0] cursor-pointer flex-col items-center justify-center rounded-[56px] px-1 transition-all duration-[250ms] ease-out active:scale-[0.97] ${
                isActive ? 'bg-[rgba(251,251,251,0.12)]' : ''
              } ${compact ? 'gap-0 pt-0' : 'gap-0.5 pt-[3px]'}`}
            >
              {/* Icon row. The rewards badge is rendered at 26×26 to
                  match Figma (the other tab icons are 20×20). It overflows
                  the row's nominal 20px height by ~3px each side, so the
                  row and button drop overflow-hidden / clip and the
                  badge can poke above/below the surrounding row. */}
              <div className="relative flex h-5 w-full items-center justify-center">
                {/* Icon-sized wrapper so the badge anchors to the ICON's
                    corner (not the full-width tab), keeping it close to the
                    tab. */}
                <div className="relative flex items-center justify-center">
                  <span
                    key={t.id === 'entradas' ? `icon-${bump}` : 'icon'}
                    className={`flex items-center justify-center ${
                      t.id === 'entradas' && bump > 0
                        ? 'animate-[iconBump_0.4s_ease-out]'
                        : ''
                    }`}
                  >
                    <img
                      src={t.icon}
                      alt=""
                      aria-hidden
                      className={t.id === 'rewards' ? 'h-[26px] w-[26px]' : 'h-5 w-5'}
                    />
                  </span>
                  {/* Entry-count badge — dark pill (Figma "Entry counter"
                      33563:154482): #3d3d3d fill, 2px #191919 ring, bold white
                      count. Keyed by entryCount so it remounts (and replays the
                      squash & stretch) on each new entry; cleanly unmounts when
                      App hides it after 10s. */}
                  {t.id === 'entradas' && badgeMounted && (
                    <span
                      key={entryCount}
                      className={`absolute -right-2.5 -top-2.5 flex min-w-[18px] items-center justify-center rounded-full border-2 border-[#191919] bg-[#3d3d3d] px-1.5 text-[10px] font-bold leading-[15px] text-[#fbfbfb] transition-opacity duration-200 ease-out ${
                        shouldShowBadge
                          ? 'opacity-100 animate-[badgePop_0.5s_ease-out]'
                          : 'opacity-0'
                      }`}
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {entryCount}
                    </span>
                  )}
                </div>
              </div>
              {/* Label — collapses (height + opacity) in compact mode so the
                  bar becomes an icon-only row. */}
              <span
                className={`overflow-hidden whitespace-nowrap text-[10px] font-medium leading-[15px] transition-all duration-[250ms] ease-out ${
                  isActive ? 'text-[#fbfbfb]' : 'text-[rgba(251,251,251,0.7)]'
                } ${compact ? 'max-h-0 opacity-0' : 'max-h-[15px] opacity-100'}`}
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search — separate circular button */}
      <button
        type="button"
        aria-label="Search"
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-[56px] border border-[rgba(251,251,251,0.16)] bg-[#191919] p-2.5 transition-all duration-[250ms] ease-out active:scale-[0.97] ${
          compact ? 'size-10' : 'size-[58px]'
        }`}
      >
        <img
          src={searchIcon}
          alt=""
          aria-hidden
          className={`transition-all duration-[250ms] ease-out ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
        />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Combined HomeScreenChrome — everything above the button     */
/* ============================================================ */
type HomeScreenChromeProps = {
  picks: Selection[];
  selectedIds: Set<string>;
  bindPick: BindPick;
  cancelActivePress: () => void;
  /** Scroll-direction signal (shared with the navbar): true while scrolling
      DOWN → collapse the leagues row; false on scroll-up / near-top → reveal. */
  headerCollapsed?: boolean;
};

function HomeScreenChromeImpl({
  picks,
  selectedIds,
  bindPick,
  cancelActivePress,
  headerCollapsed = false,
}: HomeScreenChromeProps) {
  // Two-tier sticky header: the topbar (status + logo/balance) pins at the
  // very top; the leagues row + match tabs + pill markets pin just below it
  // (so we measure the topbar's height). The leagues row lives at the top of
  // that pinned stack and collapses on scroll-down / reappears on scroll-up.
  const topbarRef = useRef<HTMLDivElement>(null);
  const [topbarH, setTopbarH] = useState(88);
  useEffect(() => {
    const measure = () => {
      if (topbarRef.current) setTopbarH(topbarRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div className="flex w-full flex-col">
      {/* TOPBAR — always pinned. Opaque so content scrolls under it; the top
          decorative glow lives here (moved from App) so it stays with it. */}
      <div ref={topbarRef} className="sticky top-0 z-30 bg-black [@media(min-width:431px)_and_(pointer:fine)]:pt-11">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[100px]"
          style={{
            backgroundImage:
              'linear-gradient(45.09deg, #4b20ff 0%, #9730ff 100%)',
            filter: 'blur(50px)',
            opacity: 0.48,
          }}
        />
        <Header />
      </div>

      {/* PINNED HEADER STACK — leagues row + match tabs + pill markets,
          pinned just below the topbar. The leagues row collapses (height +
          opacity) while scrolling down and springs back on scroll-up. */}
      <div className="sticky z-20 bg-black" style={{ top: topbarH }}>
        <div
          className={`overflow-hidden transition-all duration-[250ms] ease-out ${
            headerCollapsed ? 'max-h-0 opacity-0' : 'max-h-[96px] opacity-100'
          }`}
        >
          <LeaguesTab />
        </div>
        <MatchTabsRow />
        <TabsAndPills />
      </div>

      <MarketAccordion
        title={GOALS_MARKET}
        picks={picks}
        selectedIds={selectedIds}
        bindPick={bindPick}
        cancelActivePress={cancelActivePress}
      />
      <MarketAccordion
        title={SHOTS_MARKET}
        picks={picks}
        selectedIds={selectedIds}
        bindPick={bindPick}
        cancelActivePress={cancelActivePress}
      />
    </div>
  );
}

// Memoized — the OneClickBetSession's rAF-driven progress state re-renders
// whatever calls its hook (App). HomeScreenChrome's own props only change
// on real selection/scroll changes, so memoizing it keeps 60fps hold-progress
// re-renders from cascading through the entire pick list.
export const HomeScreenChrome = memo(HomeScreenChromeImpl);

// Memoized for the same reason as HomeScreenChrome above.
export const Navbar = memo(NavbarImpl);
