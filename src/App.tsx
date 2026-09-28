import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tierForOdds, type ButtonLiveState } from './ButtonPreviewMomios';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { playSelectionHaptic, playTierCrossingHaptic } from './haptics';
import { HomeScreenChrome, MOCK_PICKS, Navbar } from './HomeScreen';
import closeIcon from './assets/close.svg';
import compartirIcon from './assets/compartir.svg';
import reusarIcon from './assets/reusar.svg';
import { BetSlipFullSheet } from './BetSlipFullSheet';
import { BetSlipSheet } from './BetSlipSheet';
import { EntryCreatedOverlay, type Rect } from './EntryCreatedOverlay';
import { OnboardingSheet } from './OnboardingSheet';
import {
  OneClickBetPill,
  type OneClickBetPillState,
} from './OneClickBetPill';
import { computePotentialWin, useOneClickBetSession } from './oneClickBetSession';
import { useOneClickBetOnboarding } from './oneClickBetOnboarding';
import type { Selection, Tier } from './types';

// Lightning bet: how long the pressed pick shows its selected state before the
// entry-creation animation starts. Also feeds the OneClickBetSession's
// acceptToSubmitMs (see useOneClickBetSession() below) — same clock, not a
// duplicated number.
const LIGHTNING_SELECT_MS = 320;

// ONE CLICK BET — dev-preview demo stake (same fixed-demo-stake convention as
// BetSlipSheet's own `STAKE`), used ONLY by the `?debug=true` OCB dev buttons
// (debugOcbState/debugOcbProgress) when no real Quick Bet hold is active. The
// real hold-driven pill instead reads amount/potentialWin from the session.
const ONE_CLICK_BET_DEMO_STAKE = 200;

// QUICK BET ONBOARDING — "seen" state now lives in `useOneClickBetOnboarding`
// (oneClickBetOnboarding.ts), which still uses the exact same sessionStorage
// key/mechanism this comment used to describe directly.
// Delay before the sheet auto-opens on first load — lets the entry
// animations (slip mount, etc.) settle first so it doesn't fight them.
const ONBOARDING_AUTO_OPEN_DELAY_MS = 600;

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

// DEV OVERRIDE — `?forceOnboarding=true` bypasses the sessionStorage check so
// the onboarding sheet always auto-opens on load, regardless of prior
// dismissal in this session. Doesn't touch storage itself; a normal dismissal
// while the override is active still writes ONBOARDING_STORAGE_KEY as usual.
function useForceOnboarding() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('forceOnboarding') === 'true';
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
      // 2.75x — sits in [2.00, 5.00)
      return stamp([byId('rma-w')]);
    case 2:
      // 2.75 * 3.80 = 10.45x — sits in [5.00, 15.00)
      return stamp([byId('rma-w'), byId('draw')]);
    case 3:
      // 2.75 * 3.80 * 1.95 * 2.10 ≈ 42.8x — comfortably > 15.00
      return stamp([byId('rma-w'), byId('draw'), byId('lewa'), byId('vini')]);
    case 4:
      // 2.75 * 3.80 * 9.00 ≈ 94.05x — comfortably > 50.00
      return stamp([byId('rma-w'), byId('draw'), byId('mbappe-htrick')]);
  }
}

export function App() {
  const debug = useDebug();
  const forceOnboarding = useForceOnboarding();
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
  // QUICK BET ONBOARDING — auto-opens once per session (see the effect below);
  // `?forceOnboarding=true` or the debug-overlay button can reopen it anytime.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // Quick Bet default stake + the separated intro/setup onboarding state
  // (see oneClickBetOnboarding.ts) — `quickBetAmount` survives the sheet's
  // own mount/unmount and is restored on reopen, persisted in localStorage
  // by the underlying hook; see quickBetSettings.ts.
  const {
    hasSeenIntro: ocbHasSeenIntro,
    quickBetAmount,
    setQuickBetAmount,
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
  // fly into Mis entradas, then the "¿Reusar?" prompt + count badge.
  const [success, setSuccess] = useState(false);
  // Lightning bet in progress — the pressed pick is added (so its button shows
  // the selected state) but the slip is suppressed; the entry is created a
  // beat later. See lightningBet().
  const [lightning, setLightning] = useState(false);

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

  // QUICK BET ONBOARDING — auto-open once per browser session. Mount-only
  // (empty deps): reads sessionStorage + the dev override once, then waits
  // ONBOARDING_AUTO_OPEN_DELAY_MS before opening so it doesn't fight the
  // slip's own entry animation. Re-checks the incompatible-state flags
  // (listOpen/success/lightning) at fire time, not just at mount, since a
  // debug jump-to-tier or lightning bet could in principle land inside that
  // short delay window — if so, it skips silently rather than popping the
  // sheet over another in-flight overlay (no retry: this is a first-load
  // courtesy, not a persistent nag).
  useEffect(() => {
    if (ocbHasSeenIntro && !forceOnboarding) return;
    const t = window.setTimeout(() => {
      if (listOpen || success || lightning) return;
      setOnboardingOpen(true);
    }, ONBOARDING_AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [promptOpen, setPromptOpen] = useState(false);
  // Entry-count badge over "Mis entradas": appears on each new entry, holds
  // 10s, then hides. Re-shown (timer reset) every time the count changes.
  const [badgeVisible, setBadgeVisible] = useState(false);
  // Post-entry: the count badge AND the action buttons appear together and
  // auto-hide TOGETHER after 5s of no interaction. One timer per entry, so
  // they disappear at the same moment.
  useEffect(() => {
    if (entryCount === 0) return;
    setBadgeVisible(true);
    const t = setTimeout(() => {
      setBadgeVisible(false);
      setPromptOpen(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [entryCount]);

  // Keep the action buttons mounted through a fade-out before unmounting —
  // same treatment as the badge, so both ease out instead of popping.
  const promptShown = promptOpen && selections.length === 0;
  const [promptMounted, setPromptMounted] = useState(false);
  useEffect(() => {
    if (promptShown) {
      setPromptMounted(true);
      return;
    }
    const t = setTimeout(() => setPromptMounted(false), 250); // after fade-out
    return () => clearTimeout(t);
  }, [promptShown]);
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
    const available = MOCK_PICKS.filter(
      (p) => !selections.some((s) => s.id.startsWith(p.id)),
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
      return [...current, { ...pick, id: `${pick.id}-${current.length}` }];
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
  const confirmBet = useCallback(() => {
    setListOpen(false);
    setSuccess(true);
  }, []);

  // Mirrors `selections` for callbacks that need the latest value without
  // widening their own dependency list (onAccept/onSubmit must stay stable
  // across renders so the memoized OneClickBetSession `bind` doesn't churn).
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;

  // The selections that existed BEFORE a Quick Bet gesture overwrote them
  // with just the pressed pick — restored once the gesture resolves (success
  // OR failure), per "existing bet-slip restoration": a Quick Bet is a
  // straight bet that bypasses the slip, it must not permanently discard
  // whatever parlay the user already had building.
  const preLightningSelectionsRef = useRef<Selection[]>([]);

  // Measures the floating pill the instant it finishes submitting, so the
  // success ticket can morph in from its exact rect (see
  // EntryCreatedOverlay's `originRect`) instead of appearing unrelated.
  const ocbPillRef = useRef<HTMLDivElement>(null);
  const [ocbOriginRect, setOcbOriginRect] = useState<Rect | null>(null);

  // Dev-only one-shot: forces the NEXT Quick Bet submission to fail, so the
  // failure path (restore selections, dismiss pill, no success animation,
  // failure toast) can be verified without a real backend.
  const [debugForceOcbFailure, setDebugForceOcbFailure] = useState(false);
  const [ocbFailureToast, setOcbFailureToast] = useState(false);
  useEffect(() => {
    if (!ocbFailureToast) return;
    const t = window.setTimeout(() => setOcbFailureToast(false), 2600);
    return () => window.clearTimeout(t);
  }, [ocbFailureToast]);

  // Fired when the green ticket has flown into Mis entradas — settles the
  // entry (badge bump, count, "¿Reusar?" prompt) and returns to idle. Also
  // resets the OneClickBetSession (see the EntryCreatedOverlay onDone call
  // site below, which fires both together) so a completed Quick Bet leaves
  // no lingering session state behind. A Quick Bet (`lightning`) restores
  // whatever selections existed before the gesture instead of clearing them
  // — only the regular swipe-to-confirm flow clears the slip (a placed bet).
  const finishEntryCreated = useCallback(() => {
    setSuccess(false);
    if (lightning) {
      setSelections(preLightningSelectionsRef.current);
      preLightningSelectionsRef.current = [];
    } else {
      setSelections([]);
    }
    setLightning(false);
    setOcbOriginRect(null);
    setEntryCount((c) => c + 1);
    setPromptOpen(true);
  }, [lightning]);

  // ONE CLICK BET SESSION — gesture-complete and entry-creation are two
  // separate phases the session (src/oneClickBetSession.ts) calls at the
  // right moments, replacing the old single lightningBet() function:
  //
  // `onAccept` fires synchronously the instant a hold reaches 100% — applies
  // the SELECTED state to the pressed pick (so its button lights up) while
  // suppressing the slip via `lightning`. Same pre-emptive-settle guard as
  // before: a previous Quick Bet can still be mid-flight when this one
  // completes (two holds back-to-back) — settle it immediately so every
  // completed hold reliably produces exactly one entry.
  //
  // `onSubmit` fires after the session's own acceptToSubmitMs delay (the
  // pressed pick's brief "selected" hold) — plays the success animation,
  // same as lightningBet's tail end. `finishEntryCreated` (above) still runs
  // the actual post-entry actions once EntryCreatedOverlay finishes.
  const onAccept = useCallback(
    (pick: Selection) => {
      if (success || lightning) {
        finishEntryCreated();
      } else {
        // First Quick Bet in this window — remember whatever was already in
        // the slip so it can come back once this gesture resolves.
        preLightningSelectionsRef.current = selectionsRef.current;
      }
      playSelectionHaptic();
      setListOpen(false);
      setLightning(true);
      setSelections([{ ...pick, id: `${pick.id}-0` }]); // button → selected
    },
    [success, lightning, finishEntryCreated],
  );

  const onSubmit = useCallback((): boolean => {
    if (debugForceOcbFailure) {
      // Simulated failure (?debug=true only) — no success animation, roll
      // the slip back to what it was before this gesture, dismiss the pill
      // (handled by the session's cancelActive() once this returns false),
      // and surface the existing error color as a brief toast.
      setDebugForceOcbFailure(false);
      setLightning(false);
      setSelections(preLightningSelectionsRef.current);
      preLightningSelectionsRef.current = [];
      setOcbFailureToast(true);
      return false;
    }
    setOcbOriginRect(ocbPillRef.current?.getBoundingClientRect() ?? null);
    setSuccess(true);
    return true;
  }, [debugForceOcbFailure]);

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
    // quickBetAmount is the raw (string) onboarding text-field value —
    // coerce once here, the ONE place Quick Bet's numeric stake is derived.
    amount: Number(quickBetAmount) || 0,
    onAccept,
    acceptToSubmitMs: LIGHTNING_SELECT_MS,
    onSubmit,
    // Informational only (see oneClickBetOnboarding.ts) — the session
    // doesn't gate or alter gesture behavior on this yet; it's exposed so a
    // future onboarding redesign (or the pill) can query readiness without
    // this hook needing to own any onboarding UI.
    onboardingReadiness: ocbOnboardingReadiness,
  });

  // Real vs. debug-preview pill data. `ocbSession.pillVisible` is the
  // session's own visibility field (true only once an engaged hold — see
  // oneClickBetSession.ts's `engageMs` — is in progress, and stays true
  // through completed/submitting/success so the pill doesn't blink out
  // mid-flight); real session data always wins over the debug controls
  // when a hold is actually happening.
  const realOcbActive = ocbSession.pillVisible;
  // Hidden once `success` flips true — at that instant EntryCreatedOverlay
  // mounts with `ocbOriginRect` (captured a moment earlier in onSubmit) as
  // its morph-in origin, so the pill and the ticket are never both on
  // screen at once (see the "One Click Bet V2 transform" landmark).
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
          : 'filled'; // completed / submitting / success
  const ocbPillProgress = realOcbActive ? ocbSession.progress : debugOcbProgress;
  const ocbOdds = realOcbActive ? (ocbSession.odds ?? 0) : cumulativeOdds;
  const ocbAmount = realOcbActive ? ocbSession.amount : ONE_CLICK_BET_DEMO_STAKE;
  const ocbPotentialWin = realOcbActive
    ? (ocbSession.potentialWin ?? 0)
    : computePotentialWin(cumulativeOdds, ONE_CLICK_BET_DEMO_STAKE);

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

  // Whether the bet slip (collapsed pill) is on screen. Drives BOTH the slip
  // mount and the size of the dark gradient
  // behind the navbar: the gradient only needs to extend up far enough to
  // separate the slip from the content when the slip is present. When it's
  // absent, the reserved slot collapses so the gradient shrinks to just the
  // navbar band.
  const betSlipVisible =
    selections.length > 0 && !lightning && !success;

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
                      demand, bypassing the sessionStorage "already seen"
                      check (same effect as loading with ?forceOnboarding=true). */}
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
                  <button
                    onClick={() => setDebugForceOcbFailure((v) => !v)}
                    className={`mt-1.5 w-full rounded-md px-2 py-1.5 text-[11px] font-bold ${
                      debugForceOcbFailure
                        ? 'bg-[#ff6b6b] text-black'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    {debugForceOcbFailure
                      ? 'Armed — next Quick Bet hold fails'
                      : 'Simulate next Quick Bet failure'}
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
                    full height while the slip (or the post-success prompt) is
                    on screen — giving the gradient enough reach to separate
                    the slip from the content — and collapses to 0 otherwise so
                    the gradient shrinks to just the navbar band. */}
                <div
                  className="relative transition-[height] duration-300 ease-out"
                  style={{
                    height:
                      betSlipVisible || promptMounted || oneClickBetPillVisible
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
                      this whole wrapper (slip + post-success prompt) is
                      hidden via `visibility:hidden`, NOT unmounted: the slip
                      stays mounted with all its state (selections, collapse
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
                          onExpand={() => setListOpen(true)}
                          onCollapse={() => {}}
                          onRemove={removeSelection}
                          onConfirm={confirmBet}
                          onKeepAlive={() => {}}
                          onOpenList={() => setListOpen(true)}
                        />
                      )}
                    </AnimatePresence>

                    {/* Post-success "¿Reusar o compartir tu entrada?" prompt —
                        shown once an entry is created (slip gone). */}
                    {promptMounted && (
                      <div
                        key={entryCount}
                        className={`absolute inset-x-0 bottom-3 flex items-center justify-between gap-2 px-4 transition-opacity duration-200 ease-out ${
                          promptShown
                            ? 'opacity-100 animate-[promptIn_0.4s_ease-out]'
                            : 'opacity-0'
                        }`}
                        style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                      >
                        {/* Post-entry actions — Figma "entry actions"
                            (33563:154461): text + reuse/share pill buttons, a
                            divider, then the discard (×) button. All three are
                            44px circles: #191919 fill, rgba(251,251,251,0.16)
                            border, 20px icons. */}
                        <p className="w-[127px] text-[14px] font-normal leading-[21px] text-[#fbfbfb]">
                          ¿Reusar o compartir tu entrada?
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            aria-label="Reusar entrada"
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={reusarIcon} alt="" className="size-5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Compartir entrada"
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={compartirIcon} alt="" className="size-5" />
                          </button>
                          <div className="h-[21px] w-px bg-[rgba(251,251,251,0.16)]" />
                          <button
                            type="button"
                            aria-label="Descartar"
                            onClick={() => setPromptOpen(false)}
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={closeIcon} alt="" className="size-5" />
                          </button>
                        </div>
                      </div>
                    )}
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
                    <div
                      ref={ocbPillRef}
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 w-full px-4 pb-2 pt-2"
                    >
                      <OneClickBetPill
                        odds={ocbOdds}
                        amount={ocbAmount}
                        potentialWin={ocbPotentialWin}
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
                  cumulativeOdds={cumulativeOdds}
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
                badge + "¿Reusar?" prompt. Also resets the OneClickBetSession
                (cancelOcbSession) so a completed Quick Bet leaves no
                lingering session state — a no-op for the normal
                swipe-to-confirm flow, which never touched the session. */}
            {success && (
              <EntryCreatedOverlay
                originRect={ocbOriginRect}
                onCatch={() => setEntryBump((n) => n + 1)}
                onDone={() => {
                  finishEntryCreated();
                  cancelOcbSession();
                }}
              />
            )}

            {/* Quick Bet submission-failure toast — reuses the app's one
                existing error color (OnboardingSheet's ERROR_COLOR). Shown
                only via the ?debug=true "simulate failure" control, since
                there's no real backend to fail against yet. */}
            <AnimatePresence>
              {ocbFailureToast && (
                <motion.div
                  key="ocb-failure-toast"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none absolute inset-x-4 bottom-[100px] z-50 rounded-2xl border border-[rgba(255,107,107,0.4)] bg-[#1a1010]/95 px-4 py-3 text-center text-[13px] font-semibold text-[#ff6b6b]"
                >
                  No se pudo crear la entrada. Intenta de nuevo.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Bet onboarding — first-visit info sheet for the
                long-press gesture (see the auto-open effect above). Mounted
                at the same level as BetSlipFullSheet/EntryCreatedOverlay so
                it shares the phone-frame's clipping bounds and z-stack;
                never coexists with them (the auto-open effect checks
                listOpen/success/lightning before opening), so there's no
                stacking conflict to resolve here. */}
            <AnimatePresence>
              {onboardingOpen && (
                <OnboardingSheet
                  key="onboarding-sheet"
                  onClose={closeOnboarding}
                  quickBetAmount={quickBetAmount}
                  onQuickBetAmountChange={setQuickBetAmount}
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
