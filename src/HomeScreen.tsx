import { memo, useEffect, useRef, useState } from 'react';
import type { BindPick } from './oneClickBetSession';
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
import shieldIcon from './assets/shield.svg';
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

export const MOCK_PICKS: Selection[] = [
  // ===== Paris-Saint Germain vs Real Madrid =====
  { id: 'psg-w', market: 'Money line', pick: 'PSG', odds: 1.75, ...M_PSG_RMA },
  { id: 'draw', market: 'Money line', pick: 'Empate', odds: 3.8, ...M_PSG_RMA },
  { id: 'rma-w', market: 'Money line', pick: 'Real Madrid', odds: 2.75, ...M_PSG_RMA },
  { id: 'lewa', market: GOALS_MARKET, pick: 'Lewandowski', odds: 1.95, ...M_PSG_RMA },
  { id: 'mbappe', market: GOALS_MARKET, pick: 'Mbappé', odds: 1.65, ...M_PSG_RMA },
  { id: 'vini', market: GOALS_MARKET, pick: 'Vinicius', odds: 2.1, ...M_PSG_RMA },
  { id: 'mbappe-htrick', market: GOALS_MARKET, pick: 'Mbappé', odds: 9.0, ...M_PSG_RMA },
  { id: 'lewa-htrick', market: GOALS_MARKET, pick: 'Lewandowski', odds: 11.0, ...M_PSG_RMA },
  { id: 'vini-htrick', market: GOALS_MARKET, pick: 'Vinicius', odds: 16.0, ...M_PSG_RMA },
  { id: 'lewa-4goals', market: GOALS_MARKET, pick: 'Lewandowski', odds: 28.0, ...M_PSG_RMA },
  { id: 'mbappe-4goals', market: GOALS_MARKET, pick: 'Mbappé', odds: 60.0, ...M_PSG_RMA },
  { id: 'mbappe-tiros', market: SHOTS_MARKET, pick: 'Mbappé', odds: 1.55, ...M_PSG_RMA },
  { id: 'vini-tiros', market: SHOTS_MARKET, pick: 'Vinicius', odds: 1.8, ...M_PSG_RMA },
  { id: 'lewa-tiros', market: SHOTS_MARKET, pick: 'Lewandowski', odds: 1.7, ...M_PSG_RMA },
  // ===== Arsenal vs Real Madrid =====
  { id: 'ars-w', market: 'Money line', pick: 'Arsenal', odds: 2.1, ...M_ARS_RMA },
  { id: 'ars-draw', market: 'Money line', pick: 'Empate', odds: 3.4, ...M_ARS_RMA },
  { id: 'ars-rma', market: 'Money line', pick: 'Real Madrid', odds: 2.55, ...M_ARS_RMA },
  { id: 'ars-saka', market: GOALS_MARKET, pick: 'Saka', odds: 2.6, ...M_ARS_RMA },
  { id: 'ars-odegaard', market: GOALS_MARKET, pick: 'Ødegaard', odds: 3.1, ...M_ARS_RMA },
  { id: 'ars-saka-tiros', market: SHOTS_MARKET, pick: 'Saka', odds: 1.9, ...M_ARS_RMA },
  // ===== Barcelona vs PSG =====
  { id: 'fcb-w', market: 'Money line', pick: 'Barcelona', odds: 2.4, ...M_FCB_PSG },
  { id: 'fcb-draw', market: 'Money line', pick: 'Empate', odds: 3.5, ...M_FCB_PSG },
  { id: 'fcb-psg-w', market: 'Money line', pick: 'PSG', odds: 2.3, ...M_FCB_PSG },
  { id: 'fcb-yamal', market: GOALS_MARKET, pick: 'Yamal', odds: 2.2, ...M_FCB_PSG },
  { id: 'fcb-mbappe', market: GOALS_MARKET, pick: 'Mbappé', odds: 1.9, ...M_FCB_PSG },
  { id: 'fcb-yamal-tiros', market: SHOTS_MARKET, pick: 'Yamal', odds: 1.75, ...M_FCB_PSG },
  // ===== Liverpool vs Man City =====
  { id: 'liv-w', market: 'Money line', pick: 'Liverpool', odds: 2.55, ...M_LIV_MCI },
  { id: 'liv-draw', market: 'Money line', pick: 'Empate', odds: 3.6, ...M_LIV_MCI },
  { id: 'mci-w', market: 'Money line', pick: 'Manchester City', odds: 2.2, ...M_LIV_MCI },
  { id: 'liv-salah', market: GOALS_MARKET, pick: 'Salah', odds: 2.0, ...M_LIV_MCI },
  { id: 'mci-haaland', market: GOALS_MARKET, pick: 'Haaland', odds: 1.7, ...M_LIV_MCI },
  { id: 'mci-haaland-tiros', market: SHOTS_MARKET, pick: 'Haaland', odds: 1.6, ...M_LIV_MCI },
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
/*  6 chip-style pills with one selected (POPULARES) showing a  */
/*  transparent purple gradient + #4b20ff border + flame icon.  */
/* ============================================================ */
function TabsAndPills() {
  const [activePill, setActivePill] = useState<string>('POPULARES');
  const pills = ['POPULARES', 'PARTIDOS', '1era MITAD', 'TIROS', 'GOLES', 'OTROS'];

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
/*  Promo carousel — Champions card with PSG vs Real Madrid     */
/* ============================================================ */
/*  Long-press → "Lightning Straight Bet" (instant entry). Gesture/progress/  */
/*  entry-creation state now live in the centralized OneClickBetSession       */
/*  (src/oneClickBetSession.ts), mounted ONCE in App.tsx — this component      */
/*  and MarketAccordion below just receive its `bind`/`cancelActivePress`       */
/*  API as props and call `bindPick(pick)` on each button. See that file for    */
/*  the full phase machine + progress/native-listener mechanics.                */
/* ============================================================ */

type PromoCarouselProps = {
  selectedIds: Set<string>;
  bindPick: BindPick;
};

/** One match card (Figma "newLeagueMarkets" 1624:44632) — league + tags,
    the two teams + kickoff, and the money-line 3-way as odds buttons. */
function MatchCard({
  match,
  selectedIds,
  bindPick,
}: {
  match: MatchInfo;
  selectedIds: Set<string>;
  bindPick: BindPick;
}) {
  // Money-line picks for THIS match, in [home, draw, away] order.
  const lines = MOCK_PICKS.filter(
    (p) => p.matchId === match.matchId && p.market === 'Money line',
  );
  // Label by position (0 = home, draw = EMPATE, else away) — the pick names
  // are full team names ("Paris-Saint Germain"), so we can't match them to
  // abbrevs.
  const labelFor = (p: Selection, i: number) =>
    p.pick === 'Empate' ? 'EMPATE' : i === 0 ? match.homeAbbrev : match.awayAbbrev;

  return (
    // Missing asset: the decorative "light" glow blob positioned at the
    // top of the card (imgLight in the Figma export). Skipped here —
    // ask Javier to upload it; placeholder slot left below where it goes.
    <div
      className="relative w-full overflow-hidden rounded-[20px] border border-[rgba(251,251,251,0.24)] bg-black pt-2"
      style={{ backdropFilter: 'blur(10.15px)', WebkitBackdropFilter: 'blur(10.15px)' }}
    >
      {/* PLACEHOLDER for the decorative "light" graphic — Figma puts
          it at top: -36.11px overflowing slightly above the card. */}

      {/* League + tags row */}
      <div className="flex w-full items-center justify-center gap-1 px-2.5">
        <div className="flex items-center gap-1">
          <p
            className="whitespace-nowrap text-right text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.league}
          </p>
          <span
            aria-hidden
            className="block h-0.5 w-0.5 rounded-full bg-[rgba(251,251,251,0.5)]"
          />
        </div>
        <div className="flex items-start gap-1">
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            PA
          </span>
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            90&apos;
          </span>
        </div>
      </div>

      {/* Match row — Team 1 / center kickoff / Team 2 */}
      <div className="flex w-full items-start gap-2 px-2.5 pb-2">
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <img src={shieldIcon} alt="" aria-hidden className="h-8 w-8" />
          <p
            className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.homeName}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center self-stretch">
          <p
            className="whitespace-nowrap text-[12px] font-bold leading-[18px] text-[#fbfbfb]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.matchTime}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-end gap-0.5">
          <img src={shieldIcon} alt="" aria-hidden className="h-8 w-8" />
          <p
            className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            {match.awayName}
          </p>
        </div>
      </div>

      {/* Odds row — the money-line 3-way. Each toggles a MOCK_PICKS id into
          the slip; selected state = lime→cyan gradient + bold odds. Quick
          Bet gesture/hold state is driven by the shared OneClickBetSession
          via `bindPick` (src/oneClickBetSession.ts); hold progress itself
          renders only in the floating pill (OneClickBetPill.tsx), not here —
          `qb-hold`/`qb-press` now only suppress native touch/selection
          behavior. */}
      <div className="flex w-full items-center justify-end gap-1 px-2.5 pb-2.5">
        {lines.map((p, i) => {
          const selected = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              {...bindPick(p)}
              className={`qb-hold qb-press flex h-11 min-w-[58px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border px-3 py-1 transition-all duration-200 active:scale-[0.96] ${
                selected
                  ? 'border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)]'
                  : 'border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.1)] hover:bg-[rgba(251,251,251,0.14)]'
              }`}
            >
              <span
                className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.5)]"
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {labelFor(p, i)}
              </span>
              <span
                className={`whitespace-nowrap text-center text-[13px] leading-4 text-[#fbfbfb] ${
                  selected ? 'font-bold' : 'font-medium'
                }`}
                style={{ fontFamily: 'Red Hat Display, sans-serif' }}
              >
                {p.odds.toFixed(2)}x
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PromoCarousel({ selectedIds, bindPick }: PromoCarouselProps) {
  // Real horizontal scroll-snap carousel over every match on the feed.
  // Cards snap-CENTER; the active dot tracks whichever card's center is
  // nearest the carousel's center, measured from live rects so it stays
  // correct for center snapping (not just a fixed-width computation).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    let best = 0;
    let bestDist = Infinity;
    [...el.children].forEach((k, i) => {
      const kr = (k as HTMLElement).getBoundingClientRect();
      const dist = Math.abs(kr.left + kr.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(Math.max(0, Math.min(MATCHES.length - 1, best)));
  };

  return (
    // pt-3 = 12px gap from the pills row above (per design spec).
    <div className="w-full pb-2 pt-3">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-3"
      >
        {MATCHES.map((m) => (
          <div key={m.matchId} className="w-[86%] shrink-0 snap-center">
            <MatchCard match={m} selectedIds={selectedIds} bindPick={bindPick} />
          </div>
        ))}
      </div>

      {/* Carousel dots — one per match, active dot widens. */}
      <div className="mt-2 flex justify-center gap-1.5">
        {MATCHES.map((m, i) => (
          <div
            key={m.matchId}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === active ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Market accordion — Figma "marketAccordeon" node 1628:42604  */
/*  2×2 grid of player-prop cards. Each card has the player's   */
/*  silhouette (player.svg), name + position, match info, stats */
/*  icon, and an odds button at the bottom that toggles the     */
/*  corresponding pick into the bet slip. Selected state uses   */
/*  the same lime-cyan visual language as the PromoCarousel.    */
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

function MarketAccordion({
  title,
  picks,
  selectedIds,
  bindPick,
  cancelActivePress,
}: MarketProps) {
  const [isOpen, setIsOpen] = useState(true);
  // Player-prop cards for THIS market only, across every match on the feed.
  const playerPicks = picks.filter((p) => p.market === title);

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
          <span
            className="flex h-[15px] min-w-5 items-center justify-center rounded-md bg-[rgba(251,251,251,0.16)] px-1 text-[10px] font-bold leading-[15px] text-[rgba(251,251,251,0.7)]"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            90&apos;
          </span>
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
            {playerPicks.map((p) => {
              const { date, time } = splitKickoff(p.matchTime);
              const position = PLAYER_POSITION[p.pick] ?? 'DEL';
              const selected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  {...bindPick(p)}
                  // Selected state changes ONLY the odds button at the
                  // bottom (lime-cyan gradient + Bold odds); the outer
                  // card border stays neutral in both states. Quick Bet hold
                  // progress no longer renders inline anywhere on the card —
                  // it shows only in the floating pill (OneClickBetPill.tsx);
                  // the card itself stays the press TARGET (unchanged) but
                  // does not animate. `qb-press` (NOT `qb-hold`, which only
                  // carries a touch-action rule now) recursively suppresses
                  // native text-selection/callout/drag on this card and every
                  // descendant — the real fix for long-press triggering the
                  // browser's native selection UI (see index.css).
                  className="qb-press relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-[20px] border border-[rgba(251,251,251,0.12)] bg-black p-2.5 transition-all duration-200 active:scale-[0.98]"
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
                        {p.homeAbbrev}
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        vs
                      </span>
                      <span className="font-medium text-[rgba(251,251,251,0.44)]">
                        {p.awayAbbrev}
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
                        {p.pick}
                      </span>
                      <span className="text-[10px] font-medium leading-[15px] text-[rgba(251,251,251,0.44)]">
                        {position}
                      </span>
                    </div>
                  </div>

                  {/* Odds button at the bottom — same default/selected
                      visual language as the PromoCarousel buttons. Hold
                      progress no longer renders here (see the floating
                      pill, OneClickBetPill.tsx) — this stays `qb-hold` only
                      for its touch-action rule. */}
                  <div
                    className={`qb-hold flex h-11 w-full items-center justify-center overflow-hidden rounded-xl border px-3 py-1 ${
                      selected
                        ? 'border-[#d2ff72] bg-gradient-to-b from-[rgba(210,255,114,0.16)] to-[rgba(86,222,234,0.16)]'
                        : 'border-[rgba(251,251,251,0.08)] bg-[rgba(251,251,251,0.1)]'
                    }`}
                  >
                    <span
                      className={`whitespace-nowrap text-center text-[13px] leading-4 text-[#fbfbfb] ${
                        selected ? 'font-bold' : 'font-medium'
                      }`}
                      style={{ fontFamily: 'Red Hat Display, sans-serif' }}
                    >
                      {p.odds.toFixed(2)}x
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ver todos (N) — tertiary CTA */}
          <button
            type="button"
            className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 py-2 text-[14px] font-medium leading-[21px] text-[#fbfbfb] transition-opacity hover:opacity-80"
            style={{ fontFamily: 'Red Hat Display, sans-serif' }}
          >
            Ver todos ({playerPicks.length})
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

      {/* PINNED HEADER STACK — leagues row + match tabs + pill markets, all
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

      <PromoCarousel selectedIds={selectedIds} bindPick={bindPick} />
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
