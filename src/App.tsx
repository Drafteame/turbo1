import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tierForOdds, type ButtonLiveState } from './ButtonPreviewMomios';
import { buttonProgressionConfig, canConfirmEntry } from './buttonProgressionConfig';
import { playSelectionHaptic, playTierCrossingHaptic } from './haptics';
import { HomeScreenChrome, MOCK_PICKS, Navbar } from './HomeScreen';
import { BetSlipFullSheet } from './BetSlipFullSheet';
import { BetSlipSheet } from './BetSlipSheet';
import { EntryCreatedOverlay } from './EntryCreatedOverlay';
import { OnboardingSheet } from './OnboardingSheet';
import {
  OneClickBetPill,
  type OneClickBetPillState,
} from './OneClickBetPill';
import { useOneClickBetSession } from './oneClickBetSession';
import { useOneClickBetOnboarding } from './oneClickBetOnboarding';
import type { Selection, Tier } from './types';

// One Click Bet: how long the pressed pick shows its selected/filled state
// before the pill dismisses. Feeds the OneClickBetSession's acceptToSubmitMs
// (see useOneClickBetSession() below) — same clock, not a duplicated number.
const OCB_SELECTED_HOLD_MS = 320;

/* ============================================================ */
/*  Debug overlay helpers                                        */
/* ============================================================ */
function PhaseBar({ label, value }: { label: string; value: number }) {
  // Render a 0..1 motion phase as a thin progress strip.
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-[36px] text-[9px] uppercase tracking-wider text-amber-300/80">
        {label}
      </span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-300/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Debug flags from URL                                         */
/* ============================================================ */
function useDebug() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  }, []);
}

/* ============================================================ */
/*  Cumulative odds = multiplicative product of selections      */
/* ============================================================ */
function computeCumulativeOdds(selections: Selection[]): number {
  if (selections.length === 0) return 0;
  return selections.reduce((acc, s) => acc * s.odds, 1);
}

/* ============================================================ */
/*  Pre-built selection sets that land cleanly inside each tier  */
/*  Used by the debug jump-to-tier buttons.                      */
/* ============================================================ */
function selectionsForTier(target: Tier): Selection[] {
  // Hand-picked combos so each tier renders with a representative
  // odds value squarely inside its range (no overshoot into the next).
  const byId = (id: string) => MOCK_PICKS.find((p) => p.id === id)!;
  const stamp = (picks: Selection[]) =>
    picks.map((p, i) => ({ ...p, id: `${p.id}-${i}` }));

  switch (target) {
    case 0:
      return [];
    case 1:
      // 2.6x — sits in [2.00, 5.00)
      return stamp([byId('ars-rma-goals-saka-0.5-mas')]);
    case 2:
      // 2.6 * 3.1 = 8.06x — sits in [5.00, 15.00)
      return stamp([
        byId('ars-rma-goals-saka-0.5-mas'),
        byId('ars-rma-goals-odegaard-0.5-mas'),
      ]);
    case 3:
      // 2.6 * 3.1 * 1.65 * 1.8 ≈ 23.94x — comfortably inside [15.00, 50.00)
      return stamp([
        byId('ars-rma-goals-saka-0.5-mas'),
        byId('ars-rma-goals-odegaard-0.5-mas'),
        byId('psg-rma-goals-mbappe-0.5-mas'),
        byId('psg-rma-shots-vini-1.5-mas'),
      ]);
    case 4:
      // ≈ 23.94 * 1.95 * 1.6 ≈ 74.7x — comfortably > 50.00
      return stamp([
        byId('ars-rma-goals-saka-0.5-mas'),
        byId('ars-rma-goals-odegaard-0.5-mas'),
        byId('psg-rma-goals-mbappe-0.5-mas'),
        byId('psg-rma-shots-vini-1.5-mas'),
        byId('psg-rma-goals-lewa-0.5-mas'),
        byId('liv-mci-shots-haaland-1.5-mas'),
      ]);
  }
}

export function App() {
  const debug = useDebug();
  // MASTER SWITCH — see cfg.animationsEnabled. OR-ing it here suppresses the
  // T4 Siri vignette rotation (and, via the opacity gate below, the vignette
  // itself) alongside the OS-level reduced-motion preference.
  const reducedMotion =
    useReducedMotion() || !buttonProgressionConfig.animationsEnabled;
  // OS-level preference ONLY (no master-switch OR) — the OCB floating
  // pill's squash-and-stretch enter/exit, like BetSlipSheet's own
  // appear/collapse pulses, isn't gated by `cfg.animationsEnabled`: it's
  // core entry/exit feedback, not an ambient tier effect, so it keeps
  // playing even with the master switch off (matching BetSlipSheet/
  // BetSlipShell, which reference no reduced-motion flag at all for their
  // entry/exit motion). Only real prefers-reduced-motion simplifies it.
  const osReducedMotion = useReducedMotion();
  const [selections, setSelections] = useState<Selection[]>([]);
  // QUICK BET ONBOARDING — no longer auto-opens on load; only reachable via
  // the debug-overlay "Show onboarding sheet" button (or a future explicit
  // user-triggered entry point).
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // Separated intro/setup onboarding state (see oneClickBetOnboarding.ts).
  // The Quick Bet default-stake setting it also owns is no longer surfaced
  // in the onboarding sheet — a long-press never creates an entry on its
  // own (see the OneClickBetSession doc comment), so there's no per-hold
  // stake left to configure; only the odds-change acknowledgment remains.
  const {
    readiness: ocbOnboardingReadiness,
    markIntroSeen: markOcbIntroSeen,
    markSetupComplete: markOcbSetupComplete,
    saveConfiguration: saveOcbConfiguration,
  } = useOneClickBetOnboarding();
  const [speedScale, setSpeedScale] = useState(1);
  const [live, setLive] = useState<ButtonLiveState | null>(null);
  // PASS 3 — Tier 3 odds effect selector (default flames; toggled in debug).
  const [tier3OddsEffect, setTier3OddsEffect] = useState<
    'flames' | 'smoke'
  >(buttonProgressionConfig.tier3OddsEffect);
  // PASS 3 — "Bouncy entry only on FIRST mount per session". Once the bet
  // slip has mounted (and started its bounce) once, this flips to true and
  // subsequent 0 → 1 transitions skip the bounce.
  const hasBouncedOnceRef = useRef(false);

  // Bet-slip view state. The summarized purple-glass expand (BetSlipSheet's
  // `expanded` state) is retired — the slip only ever shows as the collapsed
  // pill; tapping it opens the "Resumen" floating card (BetSlipFullSheet)
  // directly, at any selection count. See the `checkpoint-pre-pill-only-slip`
  // branch for the prior behavior.
  // Full-screen "Resumen de tu entrada" sheet (opened by tapping the pill).
  const [listOpen, setListOpen] = useState(false);
  // Swipe-to-confirm success sequence: green "Entrada creada" card + ticket
  // fly into Mis entradas, then the count badge.
  const [success, setSuccess] = useState(false);
  // ONE CLICK BET — floating progress pill (see OneClickBetPill.tsx). The
  // REAL hold-driven values come from the OneClickBetSession (ocbSession,
  // defined below); `debugOcbState`/`debugOcbProgress` only drive the pill
  // when no real Quick Bet hold is active (`?debug=true` dev controls,
  // preview-only). 'hidden' means the region shows the normal bet-slip
  // pill/summarized slip as usual.
  const [debugOcbState, setDebugOcbState] =
    useState<OneClickBetPillState>('hidden');
  const [debugOcbProgress, setDebugOcbProgress] = useState(0);
  // Dev-only override so the `?debug=true` controls can preview the
  // (production-retired, see CLAUDE.md "pill-only bet slip") summarized
  // slip alongside the new pill without touching the real `expanded={false}`
  // wiring below.
  const [debugSlipExpanded, setDebugSlipExpanded] = useState(false);

  // Dismissal (× button, backdrop tap, swipe-down, or the primary CTA) —
  // persists "seen" for the rest of this browser session so it doesn't
  // reappear on a same-tab reload or route change, then unmounts the sheet
  // (AnimatePresence plays the close animation first). Still the ONE thing
  // every dismissal path does, exactly as before — only "setup complete" is
  // new, and it's a separate call fired from `onSetupComplete` below, only
  // on the "Jugar ahora" (valid amount + accepted odds) path.
  const closeOnboarding = useCallback(() => {
    markOcbIntroSeen();
    setOnboardingOpen(false);
  }, [markOcbIntroSeen]);

  // Fired ONLY when OnboardingSheet's "Jugar ahora" succeeds (valid amount +
  // odds-change accepted) — persists the odds-change preference and marks
  // setup complete, independent of `closeOnboarding`'s intro-seen flag.
  // Purely additive: does not change what the sheet shows or when it closes.
  const handleOcbSetupComplete = useCallback(
    (acceptOddsChange: boolean) => {
      saveOcbConfiguration({ acceptOddsChange });
      markOcbSetupComplete();
    },
    [saveOcbConfiguration, markOcbSetupComplete],
  );

  const [entryCount, setEntryCount] = useState(0);
  const [entryBump, setEntryBump] = useState(0); // Mis entradas icon "catch" bump
  // Navbar compresses to an icon-only row while scrolling DOWN through the
  // offer, and springs back to full size on any scroll UP (or near the top).
  // The same signal collapses the leagues row (in HomeScreenChrome).
  // `lastScrollTopRef` holds the previous scrollTop so we can read direction.
  // `navLockRef` holds a timestamp until which direction flips are ignored:
  // collapsing the leagues row shrinks the scroll content, which fires reflow
  // scroll events in the OPPOSITE direction — without the lock those flip the
  // state straight back and the bars twitch. The lock spans the 250ms morph.
  const [navCompact, setNavCompact] = useState(false);
  const lastScrollTopRef = useRef(0);
  const navLockRef = useRef(0);
  // Entry-count badge over "Mis entradas": appears on each new entry, holds
  // 5s, then hides. Re-shown (timer reset) every time the count changes.
  const [badgeVisible, setBadgeVisible] = useState(false);
  useEffect(() => {
    if (entryCount === 0) return;
    setBadgeVisible(true);
    const t = setTimeout(() => setBadgeVisible(false), 5000);
    return () => clearTimeout(t);
  }, [entryCount]);

  const selectedIds = useMemo(
    () => new Set(selections.map((s) => s.id)),
    [selections],
  );
  const cumulativeOdds = useMemo(
    () => computeCumulativeOdds(selections),
    [selections],
  );
  const tier: Tier = tierForOdds(cumulativeOdds);

  /* ---------- handlers ---------- */
  // REGRESSION FIX — removed `queueMicrotask` ref-flipping from setSelections
  // updaters. The microtask was firing BEFORE React re-rendered with the new
  // state, so BetSlipShell mounted with bouncy=false on its very first mount.
  // The ref is now flipped via BetSlipShell's onMounted callback (below).
  const addRandom = useCallback(() => {
    if (selections.length >= buttonProgressionConfig.maxSelections) return;
    // Skip options already selected AND options whose Más/Menos sibling is
    // already selected (same groupId) — the random add must respect the
    // same mutual-exclusion rule as a manual tap.
    const selectedGroupIds = new Set(
      selections
        .map((s) => MOCK_PICKS.find((p) => s.id.startsWith(p.id))?.groupId)
        .filter((g): g is string => Boolean(g)),
    );
    const available = MOCK_PICKS.filter(
      (p) =>
        !selections.some((s) => s.id.startsWith(p.id)) &&
        !selectedGroupIds.has(p.groupId),
    );
    const pool = available.length > 0 ? available : MOCK_PICKS;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setSelections((s) => [...s, { ...next, id: `${next.id}-${s.length}` }]);
    // HAPTIC — light selection tick on add. No-op on iOS Safari.
    playSelectionHaptic();
  }, [selections]);

  const togglePick = useCallback((id: string) => {
    // HAPTIC — light selection tick on every toggle (add OR remove). The
    // user's finger has already done the work; the haptic confirms it.
    // No-op on iOS Safari (no Web Haptics API in 2026).
    playSelectionHaptic();
    setSelections((current) => {
      const existing = current.find((s) => s.id.startsWith(id));
      if (existing) return current.filter((s) => s !== existing);
      if (current.length >= buttonProgressionConfig.maxSelections) return current;
      const pick = MOCK_PICKS.find((p) => p.id === id);
      if (!pick) return current;
      // Más/Menos on the same player+market+threshold are mutually
      // exclusive — selecting one replaces the other instead of stacking.
      const withoutGroupConflict = current.filter((s) => {
        const base = MOCK_PICKS.find((p) => s.id.startsWith(p.id));
        return base?.groupId !== pick.groupId;
      });
      return [
        ...withoutGroupConflict,
        { ...pick, id: `${pick.id}-${withoutGroupConflict.length}` },
      ];
    });
  }, []);

  const removeLast = useCallback(() => {
    setSelections((s) => {
      if (s.length === 0) return s;
      // HAPTIC — same light tick as toggle/add so removal feels consistent.
      playSelectionHaptic();
      return s.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => setSelections([]), []);

  const jumpToTier = useCallback((target: Tier) => {
    setSelections(selectionsForTier(target));
  }, []);

  // Remove a single selection from the "Resumen" floating card (× on its row).
  const removeSelection = useCallback((id: string) => {
    playSelectionHaptic();
    setSelections((s) => s.filter((sel) => sel.id !== id));
  }, []);

  // Place the bet from the "Resumen" floating card (swipe-to-confirm). Prototype
  // behavior: clear the slip, as a placed bet would. Wire to real
  // bet-placement here when a backend exists.
  // Swipe-to-confirm → play the success animation (slip hidden behind the
  // green overlay via `success`). The overlay's onDone finishes the sequence.
  // Guarded here too (not just in the UI, which already disables the swipe
  // track below `minSelections`) — see buttonProgressionConfig's
  // `canConfirmEntry`. Also guarded against `success` already being true:
  // an entry is created by exactly one completed swipe, so while one is
  // already mid-creation/animation, a second call (a duplicate tap, or a
  // stray callback) must be a no-op rather than starting another entry.
  const confirmBet = useCallback(() => {
    if (success) return;
    if (!canConfirmEntry(selections.length)) return;
    setListOpen(false);
    setSuccess(true);
  }, [selections.length, success]);

  // Fired when the green ticket has flown into Mis entradas — settles the
  // entry (badge bump, count) and returns to idle. Only the real
  // swipe-to-confirm flow ever sets `success`, so this always clears the
  // slip, same as a placed bet.
  const finishEntryCreated = useCallback(() => {
    setSuccess(false);
    setSelections([]);
    setEntryCount((c) => c + 1);
  }, []);

  // ONE CLICK BET SESSION — a completed hold only toggles the pressed pick's
  // normal selection state, exactly like a tap (see oneClickBetSession.ts's
  // doc comment): it can never create an entry by itself, since an entry
  // requires at least `slipEntry.minSelections` (2) picks, placed only
  // through the normal swipe-to-confirm flow. `togglePick` already reuses the
  // same add/remove/group-exclusion rules a manual tap uses.
  const onAccept = useCallback(
    (pick: Selection) => togglePick(pick.id),
    [togglePick],
  );

  const {
    session: ocbSession,
    bind: bindPick,
    cancelActive: cancelOcbSession,
  } = useOneClickBetSession(togglePick, {
    holdDurationMs: buttonProgressionConfig.longPress.durationMs,
    engageMs: 150,
    reverseMs: buttonProgressionConfig.longPress.reverseMs,
    // Kept in lockstep with the pill's own exit-animation duration (see
    // OneClickBetPill.tsx / buttonProgressionConfig.ocbPillMotion.exit) so
    // the session only resets — restoring the bet slip — once the pill's
    // squash/stretch exit has visually finished.
    exitMs: osReducedMotion
      ? buttonProgressionConfig.ocbPillMotion.exit.reducedDurationMs
      : buttonProgressionConfig.ocbPillMotion.exit.durationMs,
    cancelTolerancePx: buttonProgressionConfig.longPress.cancelTolerancePx,
    onAccept,
    acceptToSubmitMs: OCB_SELECTED_HOLD_MS,
    // Informational only (see oneClickBetOnboarding.ts) — the session
    // doesn't gate or alter gesture behavior on this yet; it's exposed so a
    // future onboarding redesign (or the pill) can query readiness without
    // this hook needing to own any onboarding UI.
    onboardingReadiness: ocbOnboardingReadiness,
  });

  // Real vs. debug-preview pill data. `ocbSession.pillVisible` is the
  // session's own visibility field (true only once an engaged hold — see
  // oneClickBetSession.ts's `engageMs` — is in progress, through the brief
  // post-complete "filled" hold); real session data always wins over the
  // debug controls when a hold is actually happening.
  const realOcbActive = ocbSession.pillVisible;
  const oneClickBetPillVisible =
    (realOcbActive || debugOcbState !== 'hidden') && !success;
  const ocbPillState: OneClickBetPillState = !realOcbActive
    ? debugOcbState
    : ocbSession.phase === 'candidate' || ocbSession.phase === 'pressing'
      ? 'pressing'
      : ocbSession.phase === 'reversing'
        ? 'reversing'
        : ocbSession.phase === 'exiting'
          ? 'exiting'
          : 'filled'; // completed
  const ocbPillProgress = realOcbActive ? ocbSession.progress : debugOcbProgress;
  const ocbOdds = realOcbActive ? (ocbSession.odds ?? 0) : cumulativeOdds;

  /* ---------- tier-crossing haptic ---------- */
  // Watch `tier` for changes. On any transition between adjacent tiers
  // (or jumps spanning multiple at once via the debug buttons), fire a
  // medium-impact haptic. Skip the initial mount so we don't vibrate on
  // page load. No-op on iOS Safari.
  const prevTierRef = useRef<Tier>(tier);
  useEffect(() => {
    if (prevTierRef.current !== tier) {
      playTierCrossingHaptic();
      prevTierRef.current = tier;
    }
  }, [tier]);

  // Map selected pick ids back to base ids (without -N suffix) for the
  // market accordion so it can highlight which picks are in the slip.
  const baseSelectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const sel of selections) {
      // id format: "psg-w-0" -> base "psg-w"
      const lastDash = sel.id.lastIndexOf('-');
      s.add(sel.id.slice(0, lastDash));
    }
    return s;
  }, [selections]);

  // Whether the bet slip (collapsed pill) is on screen. Visible at ANY
  // selection count, including 0 (empty-state pill: 0 bets, $0 / $0,
  // disabled CTA) — only the success overlay hides it (the One Click Bet
  // floating pill sits in the same slot and is hidden/shown separately, see
  // `oneClickBetPillVisible`; a long-press no longer suppresses the slip,
  // since it only ever adds/selects a pick into it). Drives BOTH the slip
  // mount and the size of the dark gradient behind the navbar: the gradient
  // only needs to extend up far enough to separate the slip from the
  // content when the slip is present. When it's absent, the reserved slot
  // collapses so the gradient shrinks to just the navbar band.
  const betSlipVisible = !success;

  /* ============================================================ */
  /*  Render                                                      */
  /* ============================================================ */
  return (
    // RESPONSIVE LAYOUT — `[@media(min-width:431px)_and_(pointer:fine)]:`
    // (inline arbitrary variant, not a named `screens` entry — Tailwind
    // disables `min-[…]`/`max-[…]` arbitrary variants globally if `screens`
    // contains any object value) = width ≥ 431px AND pointer: fine (real
    // mouse). Width alone isn't reliable: some
    // Android phones report a CSS viewport width > 430px (larger screens,
    // OS display-scaling, landscape) and would otherwise be misclassified
    // as "desktop" here, forcing them into the fixed 390×844 mockup box —
    // pointer: fine reliably excludes touchscreens regardless of width.
    //   not desktop (real mobile browsers): full-bleed, no mockup chrome.
    //                                    Inner fills 100dvh × 100vw, square
    //                                    corners, no bezel, no shadow, notch
    //                                    hidden (real device has its own).
    //   desktop (desktop demo + tablets): 390×844 phone mockup (clamped to
    //                                      the real viewport) centered with
    //                                      bezel, rounded corners, shadow,
    //                                      notch — preserves the original
    //                                      desktop preview.
    //   ≥ 640px  (sm): extra outer padding so the mockup floats away
    //                  from the viewport edges.
    // 100dvh (dynamic viewport height) accounts for iOS Safari's URL bar
    // expand/collapse — uses the *current* viewport so the navbar doesn't
    // get pushed under browser chrome.
    <div className="flex min-h-[100dvh] w-full items-stretch justify-center [@media(min-width:431px)_and_(pointer:fine)]:items-center [@media(min-width:431px)_and_(pointer:fine)]:p-2 min-[640px]:p-6">
      {/* Phone frame */}
      <div className="relative w-full [@media(min-width:431px)_and_(pointer:fine)]:w-auto">
        <div className="[@media(min-width:431px)_and_(pointer:fine)]:rounded-[44px] [@media(min-width:431px)_and_(pointer:fine)]:bg-black/40 [@media(min-width:431px)_and_(pointer:fine)]:p-3 [@media(min-width:431px)_and_(pointer:fine)]:shadow-[0_30px_80px_rgba(75,32,255,0.25)] [@media(min-width:431px)_and_(pointer:fine)]:ring-1 [@media(min-width:431px)_and_(pointer:fine)]:ring-white/10">
          <div
            className="relative h-[100dvh] w-full overflow-hidden [@media(min-width:431px)_and_(pointer:fine)]:h-[min(844px,100dvh)] [@media(min-width:431px)_and_(pointer:fine)]:w-[min(390px,100vw)] [@media(min-width:431px)_and_(pointer:fine)]:rounded-[36px]"
            style={{
              // Matches the Figma newLeagueMarkets card bg (#000000) so the
              // chrome around the card and the card itself read as one
              // continuous surface. The outer bezel (`bg-black/40` above)
              // is a stylistic phone-mockup frame; leave it.
              background: '#000000',
            }}
          >
            {/* Notch — desktop mockup only. On real mobile the device has
                its own physical notch / dynamic island, so we hide ours. */}
            <div className="absolute left-1/2 top-2 z-30 hidden h-6 w-28 -translate-x-1/2 rounded-full bg-black [@media(min-width:431px)_and_(pointer:fine)]:block" />

            {/* T4 SIRI-STYLE VIGNETTE.
                Multi-color perimeter glow modeled on iOS 26 Siri
                activation. A heavily-blurred conic gradient with
                Apple-Intelligence-style colors (pink/magenta, purple,
                blue-purple, warm amber) rotates around the screen.
                A radial mask keeps the gradient clipped to the
                perimeter — inner 55% of the radius stays transparent
                so the markets/offers in the center column are
                untouched.

                Structure:
                  outer motion.div = the mask layer + fade-in opacity
                  inner motion.div = the rotating conic gradient

                The inner div is sized at 200% × 200% with inset -50%
                so rotation never reveals empty corners.

                Sits at z-[15] — ABOVE scrollable content (z-10) so it
                tints the edges of the cards, but BELOW the bet slip +
                navbar (z-20) so the CTA stays at full brightness.

                Tunables live at `cfg.tier4.vignette`. */}
            <motion.div
              aria-hidden
              className="vignette-shape-breathe pointer-events-none absolute inset-0 z-[15]"
              style={{
                overflow: 'hidden',
                // The radial mask is built from CSS custom properties
                // declared in src/index.css (.vignette-shape-breathe).
                // Those properties oscillate over an 18s loop so the
                // mask's ellipse subtly morphs (width, height, center,
                // and inner-stop each animate on slightly different
                // phases). Same trick the iOS 26 Siri activation uses
                // — continuous color rotation + organic shape morph.
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity:
                  tier === 4 && !reducedMotion
                    ? buttonProgressionConfig.tier4.vignette.opacityMax
                    : 0,
              }}
              transition={{
                duration:
                  buttonProgressionConfig.tier4.vignette.fadeInMs / 1000,
                ease: 'easeOut',
              }}
            >
              <motion.div
                style={{
                  position: 'absolute',
                  inset: '-50%',
                  width: '200%',
                  height: '200%',
                  // Conic gradient using the SAME two-color palette as
                  // the bet-slip outer glow swirl (see .outer-glow-swirl
                  // in src/index.css): #4e7bff (blue) alternating with
                  // #9730ff (purple). 5 stops at 90deg intervals create
                  // two visible "color crests" of each hue as the
                  // gradient rotates — so two waves of blue→purple
                  // sweep across the perimeter per rotation. Keeps the
                  // vignette tonally locked to the button's own glow
                  // so the screen edges and the bet slip read as one
                  // color system.
                  backgroundImage:
                    'conic-gradient(from 0deg, #4e7bff, #9730ff, #4e7bff, #9730ff, #4e7bff)',
                  // Heavy blur so the conic reads as soft light, not
                  // hard-edged color wedges.
                  filter: 'blur(40px)',
                  // Hardware-accelerate the rotation so it stays
                  // smooth on mobile.
                  willChange: 'transform',
                }}
                animate={
                  tier === 4 && !reducedMotion ? { rotate: 360 } : { rotate: 0 }
                }
                transition={
                  tier === 4 && !reducedMotion
                    ? {
                        // 16-second full rotation — slow enough to feel
                        // meditative, fast enough that the colors are
                        // visibly moving when the user looks at the screen.
                        duration: 16,
                        repeat: Infinity,
                        ease: 'linear',
                      }
                    : { duration: 0.3 }
                }
              />
            </motion.div>

            {/* Top decorative light moved into the sticky topbar
                (HomeScreenChrome) so it stays with the pinned header. */}

            {/* Scrollable content area */}
            <div
              className="no-scrollbar absolute inset-0 z-10 overflow-y-auto pb-[160px]"
              onScroll={(e) => {
                const st = e.currentTarget.scrollTop;
                const delta = st - lastScrollTopRef.current;
                lastScrollTopRef.current = st;
                // Ignore scroll events during the post-toggle lock window so
                // the collapse-driven reflow can't flip the state back.
                if (Date.now() < navLockRef.current) return;
                let next: boolean | null = null;
                if (st <= 8) next = false; // full near the top
                else if (delta > 8) next = true; // scrolling down
                else if (delta < -8) next = false; // scrolling up
                if (next === null) return;
                const target = next;
                setNavCompact((c) => {
                  if (c !== target) navLockRef.current = Date.now() + 320;
                  return target;
                });
              }}
            >
              <HomeScreenChrome
                picks={MOCK_PICKS}
                selectedIds={baseSelectedIds}
                bindPick={bindPick}
                cancelActivePress={cancelOcbSession}
                headerCollapsed={navCompact}
              />
              {/* Debug controls inline (only visible with ?debug=true) */}
              {debug && (
                <div className="mx-3 mb-2 mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                  <div className="mb-2 text-[11px] font-bold text-amber-300">
                    DEBUG · jump to tier
                  </div>
                  <div className="mb-2 flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((t) => (
                      <button
                        key={t}
                        onClick={() => jumpToTier(t as Tier)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${
                          tier === t
                            ? 'bg-amber-300 text-black'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        T{t}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSpeedScale((s) => (s === 1 ? 3 : 1))}
                    className="w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    Animation speed: {speedScale === 1 ? '1× normal' : '3× slow'}
                  </button>
                  {/* PASS 3 — Tier 3 odds effect variant toggle. */}
                  <button
                    onClick={() =>
                      setTier3OddsEffect((e) =>
                        e === 'flames' ? 'smoke' : 'flames',
                      )
                    }
                    className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    T3 odds effect: {tier3OddsEffect === 'flames' ? '🔥 flames' : '💨 smoke'}
                  </button>
                  {/* DEV OVERRIDE — reopens the Quick Bet onboarding sheet on
                      demand. This is now the only way to open it; it no
                      longer auto-opens on load. */}
                  <button
                    onClick={() => setOnboardingOpen(true)}
                    className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    Show onboarding sheet
                  </button>
                </div>
              )}

              {/* DEV CONTROLS — One Click Bet floating pill preview.
                  Real gesture state now (see ocbSession above); the debug
                  buttons below only drive the pill when no real hold is
                  active. Never rendered outside ?debug=true. */}
              {debug && (
                <div className="mx-3 mb-2 mt-3 rounded-xl border border-[#4b20ff]/40 bg-[#4b20ff]/10 p-3">
                  <div className="mb-2 text-[11px] font-bold text-[#b18bff]">
                    DEBUG · one click bet pill
                  </div>
                  <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setDebugOcbState('hidden');
                        setDebugSlipExpanded(false);
                      }}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-bold ${
                        debugOcbState === 'hidden' && !debugSlipExpanded
                          ? 'bg-[#b18bff] text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      Bet-slip pill
                    </button>
                    <button
                      onClick={() => {
                        setDebugOcbState('hidden');
                        setDebugSlipExpanded(true);
                      }}
                      disabled={selections.length === 0}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-bold disabled:opacity-30 ${
                        debugOcbState === 'hidden' && debugSlipExpanded
                          ? 'bg-[#b18bff] text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      Summarized slip
                    </button>
                    <button
                      onClick={() => setDebugOcbState('default')}
                      disabled={selections.length === 0}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-bold disabled:opacity-30 ${
                        debugOcbState === 'default'
                          ? 'bg-[#b18bff] text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      OCB: default
                    </button>
                    <button
                      onClick={() => setDebugOcbState('filled')}
                      disabled={selections.length === 0}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-bold disabled:opacity-30 ${
                        debugOcbState === 'filled'
                          ? 'bg-[#b18bff] text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      OCB: filled
                    </button>
                  </div>
                  {/* "pressing" progress scrub — only meaningful once the
                      pill is in the 'pressing' state. */}
                  <div className="mb-1.5 flex gap-1.5">
                    {[0, 0.25, 0.5, 0.75].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setDebugOcbState('pressing');
                          setDebugOcbProgress(p);
                        }}
                        disabled={selections.length === 0}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold disabled:opacity-30 ${
                          debugOcbState === 'pressing' && debugOcbProgress === p
                            ? 'bg-[#b18bff] text-black'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {Math.round(p * 100)}%
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setDebugOcbState('default')}
                    disabled={selections.length === 0}
                    className="mb-1.5 w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-30"
                  >
                    ▶ Transition: bet slip → One Click Bet
                  </button>
                  <button
                    onClick={() => setDebugOcbState('hidden')}
                    className="w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    ◀ Restore previous bet slip
                  </button>
                </div>
              )}

              {/* Action controls — Add / Remove / Reset (dev-only, same
                  gating as the amber debug box above; ?debug=true to use). */}
              {debug && (
                <div className="mx-3 mb-2 mt-3 flex gap-2">
                  <button
                    onClick={addRandom}
                    disabled={
                      selections.length >= buttonProgressionConfig.maxSelections
                    }
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#4b20ff] to-[#9730ff] px-3 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
                  >
                    + Añadir selección
                  </button>
                  <button
                    onClick={removeLast}
                    disabled={selections.length === 0}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white/90 disabled:opacity-30"
                  >
                    − Quitar
                  </button>
                  <button
                    onClick={reset}
                    disabled={selections.length === 0}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white/90 disabled:opacity-30"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Fixed bottom: gradient fade + button slot + navbar.
                PASS 3 — The bet slip is now conditionally mounted via
                AnimatePresence (mode="wait" queues the entry until any
                in-flight exit finishes). A reserved-height slot keeps the
                navbar pinned even when the button is unmounted.

                RESPONSIVE — pb-safe-bottom uses env(safe-area-inset-bottom)
                so on iOS phones with a home indicator the navbar floats
                above it instead of being half-obscured. No-op on desktop
                (the env value is 0) and on devices without a home
                indicator. */}
            <div
              className="absolute inset-x-0 bottom-0 z-20"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Upper fade above the bet-slip area.
                  T0-T3: full 0.8 → transparent to anchor the slip
                         visually against the markets above.
                  T4:    much softer (0.35 max) so the dark backdrop
                         doesn't compete with the Siri vignette's
                         colored perimeter bloom — at T4 the vignette
                         alone provides plenty of perimeter framing,
                         and pushing the dark backdrop to full strength
                         creates a visible rectangular "panel" on top
                         of the colored bloom. */}
              <div
                className="pointer-events-none absolute inset-x-0 -top-10 h-10"
                style={{
                  background:
                    tier === 4
                      ? 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)'
                      : 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                }}
              />
              <div
                className="relative"
                style={{
                  // Same tier-conditional rule as the upper fade above
                  // — the lower gradient softens at T4 so it doesn't
                  // read as a rectangular panel against the rotating
                  // vignette colors. Start opacity matches the upper
                  // fade's end opacity so there's never a discontinuity
                  // at the boundary regardless of tier.
                  background:
                    tier === 4
                      ? 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)'
                      : 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
                  // Smooth-fade the gradient swap during tier change so
                  // the dark backdrop fades up/down with the vignette
                  // rather than snapping.
                  transition: 'background 700ms ease-out',
                }}
              >
                {/* Reserved-height slot. The slip is anchored to its BOTTOM
                    (against the navbar), so this height only controls how far
                    the dark gradient extends ABOVE the slip. It reserves the
                    full height while the slip is on screen — giving the
                    gradient enough reach to separate the slip from the
                    content — and collapses to 0 otherwise so the gradient
                    shrinks to just the navbar band. */}
                <div
                  className="relative transition-[height] duration-300 ease-out"
                  style={{
                    height:
                      betSlipVisible || oneClickBetPillVisible
                        ? buttonProgressionConfig.slotReservedHeightPx
                        : 0,
                  }}
                >
                  {/* BET SLIP — pill-only now (the summarized purple-glass
                      expand is retired, see `checkpoint-pre-pill-only-slip`).
                      `expanded` is normally always false, so BetSlipSheet
                      never morphs into the glass card in production; the
                      `debug && debugSlipExpanded` override only ever fires
                      from the `?debug=true` "Summarized slip" dev button
                      above, purely to preview that dormant layout — tapping/
                      swiping the pill still always opens the "Resumen"
                      floating card (BetSlipFullSheet) via onExpand/onOpenList.
                      onCollapse/onKeepAlive are unreachable no-ops —
                      BetSlipSheet only fires them from gestures on its
                      expanded content. Anchored to the slot's bottom
                      baseline; the 8px gap above the navbar comes from the
                      pill's own pb-2. Only one bet-slip element ever exists,
                      so nothing shows behind it.

                      ONE CLICK BET VISIBILITY ARBITRATION — when the OCB
                      floating pill is visible (`oneClickBetPillVisible`),
                      this whole wrapper (the slip) is hidden via
                      `visibility:hidden`, NOT unmounted: the slip stays
                      mounted with all its state (selections, collapse
                      position, etc.) untouched and plays no exit animation,
                      so restoring is just flipping visibility back — never
                      recreated from scratch. */}
                  <div
                    className="absolute inset-x-0 bottom-0 z-10"
                    style={
                      oneClickBetPillVisible
                        ? { visibility: 'hidden', pointerEvents: 'none' }
                        : undefined
                    }
                    aria-hidden={oneClickBetPillVisible}
                  >
                    <AnimatePresence>
                      {betSlipVisible && (
                        <BetSlipSheet
                          key="bet-slip-sheet"
                          selections={selections}
                          cumulativeOdds={cumulativeOdds}
                          expanded={debug && debugSlipExpanded}
                          onExpand={() => {
                            if (selections.length > 0) setListOpen(true);
                          }}
                          onCollapse={() => {}}
                          onRemove={removeSelection}
                          onConfirm={confirmBet}
                          onKeepAlive={() => {}}
                          onOpenList={() => setListOpen(true)}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ONE CLICK BET — floating progress pill. Occupies the
                      EXACT same slot as the bet-slip pill above (same
                      px-4/pb-2/pt-2 padding as ButtonPreviewMomios's own root,
                      same z-10 stacking, same bottom-anchored container) so it
                      never introduces a new position or extra layout height.
                      Fed real OneClickBetSession data whenever a hold is
                      actually in progress (see ocbPillState/ocbOdds/etc.
                      above); falls back to the `?debug=true` preview
                      controls otherwise. Still pointer-events-none — no
                      tap/hold handlers live on the pill itself, the gesture
                      is bound to the pick buttons via `bindPick`. */}
                  {oneClickBetPillVisible && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 w-full px-4 pb-2 pt-2">
                      <OneClickBetPill
                        odds={ocbOdds}
                        state={ocbPillState}
                        progress={ocbPillProgress}
                        reducedMotion={osReducedMotion}
                      />
                    </div>
                  )}
                </div>
                <Navbar
                  entryCount={entryCount}
                  bump={entryBump}
                  badgeVisible={badgeVisible}
                  compact={navCompact}
                />
              </div>
            </div>

            {/* Full-screen "Resumen de tu entrada" sheet — opens by tapping
                the collapsed pill at any selection count; swipe down or ×
                closes it. */}
            <AnimatePresence>
              {listOpen && selections.length > 0 && (
                <BetSlipFullSheet
                  key="bet-slip-full-sheet"
                  selections={selections}
                  onRemove={removeSelection}
                  onClearAll={() => {
                    setSelections([]);
                    setListOpen(false);
                  }}
                  onClose={() => setListOpen(false)}
                  onConfirm={confirmBet}
                />
              )}
            </AnimatePresence>

            {/* Swipe-to-confirm success — green "Entrada creada" card that
                flies into Mis entradas, then finishEntryCreated() pops the
                count badge. Also resets the OneClickBetSession
                (cancelOcbSession) so any lingering hold state is cleared —
                a no-op in practice, since a hold never sets `success`
                itself (see betSlipVisible's comment). */}
            {success && (
              <EntryCreatedOverlay
                onCatch={() => setEntryBump((n) => n + 1)}
                onDone={() => {
                  finishEntryCreated();
                  cancelOcbSession();
                }}
              />
            )}

            {/* Quick Bet onboarding — first-visit info sheet for the
                long-press gesture (see the auto-open effect above). Mounted
                at the same level as BetSlipFullSheet/EntryCreatedOverlay so
                it shares the phone-frame's clipping bounds and z-stack. */}
            <AnimatePresence>
              {onboardingOpen && (
                <OnboardingSheet
                  key="onboarding-sheet"
                  onClose={closeOnboarding}
                  onSetupComplete={handleOcbSetupComplete}
                />
              )}
            </AnimatePresence>

            {/* Debug overlay (tier badge + live ambient phases) */}
            {debug && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-2 bottom-[170px] z-40 w-[156px] rounded-lg border border-amber-400/40 bg-black/85 px-2.5 py-1.5 text-left"
              >
                <div className="text-[9px] font-bold uppercase tracking-widest text-amber-300">
                  Debug
                </div>
                <div className="text-[12px] font-black text-white">
                  Tier {tier} · {buttonProgressionConfig.tiers[tier].name}
                </div>
                <div className="text-[10px] font-medium text-white/70">
                  Odds {cumulativeOdds.toFixed(2)}x
                </div>
                <div className="text-[10px] font-medium text-white/70">
                  {selections.length} / {buttonProgressionConfig.maxSelections} picks
                </div>
                {/* Live phase readouts — driven by ButtonPreviewMomios useMotionValueEvent */}
                <div className="mt-1 flex items-center justify-between border-t border-amber-400/20 pt-1">
                  <span className="text-[9px] uppercase tracking-wider text-amber-300/80">
                    Tremor
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      live?.tremorActive ? 'bg-amber-300' : 'bg-white/20'
                    }`}
                  />
                </div>
                <PhaseBar label="Glow" value={live?.borderPhase ?? 0} />
                <PhaseBar label="Breath" value={live?.breathPhase ?? 0} />
                {/* T3 odds effect toggle — pinned here so it's always reachable */}
                <button
                  onClick={() =>
                    setTier3OddsEffect((e) =>
                      e === 'flames' ? 'smoke' : 'flames',
                    )
                  }
                  className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-white"
                >
                  T3: {tier3OddsEffect === 'flames' ? '🔥 flames' : '💨 smoke'}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
