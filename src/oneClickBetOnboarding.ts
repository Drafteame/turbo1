import { useCallback, useState } from 'react';
import { isValidMoneyAmount } from './money';
import { useQuickBetAmount } from './quickBetSettings';

/**
 * ONE CLICK BET ONBOARDING — separates "has the user seen the feature
 * explained" from "has the user completed the required setup", per the
 * future product split:
 *   - Feature discovery: a short intro (video + acknowledgment CTA, no
 *     amount/odds ask) — `hasSeenIntro`.
 *   - Feature setup: the first real press-and-hold requests the required
 *     configuration (Quick Bet amount, odds-change acceptance) —
 *     `hasCompletedSetup`.
 *
 * TODAY, `OnboardingSheet` still does both in one shot (shown once per
 * browser session, combining the intro copy with the amount/odds inputs).
 * This module formalizes the two concepts as independent, separately
 * persisted state so that split can be implemented later without touching
 * `useOneClickBetSession` or the gesture code — nothing here changes when
 * the current combined sheet opens, closes, or what it shows.
 *
 * PERSISTENCE:
 *   - `hasSeenIntro` reuses the EXACT existing sessionStorage key/mechanism
 *     the combined sheet already used for its one "shown" flag (no
 *     migration needed — same key, same storage, same per-session
 *     lifetime). Every current dismissal path (Omitir, Jugar ahora,
 *     backdrop, ×, swipe, Escape) still only ever calls `markIntroSeen()`,
 *     exactly like the old `closeOnboarding` did — so "seen" still just
 *     means "the sheet was shown and dismissed," identical to today.
 *   - `hasCompletedSetup` is NEW (localStorage — setup is a durable
 *     preference, not a per-session flag) and defaults to `false` for
 *     brand-new storage. Existing users are not forced through it again
 *     unexpectedly: on first read, if a valid `quickBetAmount` is already
 *     saved (the strongest available signal someone already completed the
 *     old combined flow), `hasCompletedSetup` is inferred `true` and
 *     persisted immediately.
 *   - `acceptOddsChange` is NEW (localStorage). Today this checkbox lives as
 *     ephemeral local state inside `OnboardingSheet` (resets to unchecked
 *     every time the sheet mounts) and is never read back — so persisting
 *     it here does not change what the sheet displays; `OnboardingSheet`
 *     is not wired to read this value back into its own initial state yet.
 *     It's only written, via the new optional `onSetupComplete` callback,
 *     the moment the user completes the CURRENT combined flow through
 *     "Jugar ahora" (valid amount + checkbox checked) — the one point
 *     today's flow already knows both values are valid together.
 *   - `quickBetAmount` is unchanged — still owned by `useQuickBetAmount`
 *     (quickBetSettings.ts). Reused here, not duplicated.
 */

export const ONE_CLICK_BET_INTRO_SEEN_KEY = 'qb:onboarding-shown:v1';
export const ONE_CLICK_BET_SETUP_COMPLETE_KEY = 'qb:setup-complete:v1';
export const ONE_CLICK_BET_ODDS_ACCEPTED_KEY = 'qb:odds-change-accepted:v1';

export type OneClickBetReadiness = 'ready' | 'needsIntro' | 'needsSetup';

function readBoolFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeBoolFlag(store: Storage, key: string): void {
  try {
    store.setItem(key, '1');
  } catch {
    // Storage unavailable (private-mode edge cases) — the flag just won't
    // persist across reloads/sessions; current-tab behavior is unaffected.
  }
}

function readLocalBoolFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Backward-compatible inference for pre-existing users: no explicit
 *  `hasCompletedSetup` flag exists for anyone who went through the old
 *  combined sheet before this split, but a valid saved amount is the
 *  strongest signal they already did. Inferred once, then persisted like
 *  any explicit completion so it's stable on subsequent reads. */
function readOrInferSetupComplete(quickBetAmount: string): boolean {
  if (readLocalBoolFlag(ONE_CLICK_BET_SETUP_COMPLETE_KEY)) return true;
  if (isValidMoneyAmount(quickBetAmount)) {
    writeBoolFlag(localStorage, ONE_CLICK_BET_SETUP_COMPLETE_KEY);
    return true;
  }
  return false;
}

export function computeOneClickBetReadiness(state: {
  hasSeenIntro: boolean;
  hasCompletedSetup: boolean;
}): OneClickBetReadiness {
  if (!state.hasSeenIntro) return 'needsIntro';
  if (!state.hasCompletedSetup) return 'needsSetup';
  return 'ready';
}

/**
 * FUTURE INTEGRATION BOUNDARY — the explicit surface a future onboarding
 * redesign (separate intro modal + setup prompt) can call into without
 * needing to know about sessionStorage/localStorage keys or React state
 * plumbing. Nothing in the app calls `requestSetup`/`resumeInterruptedIntent`
 * yet — they're placeholders documenting the intended seam.
 */
export interface OneClickBetOnboardingBoundary {
  /** Mark the discovery/intro step as seen (does not imply setup is done). */
  markIntroSeen: () => void;
  /** Placeholder: the future intro CTA will call this to hand off into the
   *  setup step. No-op today — the current combined sheet doesn't need it,
   *  since it shows both steps at once. */
  requestSetup: () => void;
  /** Persist the setup values (amount + odds-change preference) without
   *  necessarily marking setup complete — mirrors "save configuration" as
   *  its own step, separate from "mark setup complete" below. */
  saveConfiguration: (config: { amount?: string; acceptOddsChange?: boolean }) => void;
  /** Mark the setup step complete (independent of `markIntroSeen`). */
  markSetupComplete: () => void;
  /** Placeholder: resuming a Quick Bet intent interrupted by onboarding
   *  (e.g. the user's hold triggered a setup prompt mid-gesture) is an
   *  explicitly future behavior — not implemented, intentionally a no-op. */
  resumeInterruptedIntent: () => void;
}

export function useOneClickBetOnboarding() {
  const [quickBetAmount, setQuickBetAmount] = useQuickBetAmount();

  const [hasSeenIntro, setHasSeenIntro] = useState(() =>
    readBoolFlag(ONE_CLICK_BET_INTRO_SEEN_KEY),
  );
  const [hasCompletedSetup, setHasCompletedSetup] = useState(() =>
    readOrInferSetupComplete(quickBetAmount),
  );
  const [acceptOddsChange, setAcceptOddsChangeState] = useState(() =>
    readLocalBoolFlag(ONE_CLICK_BET_ODDS_ACCEPTED_KEY),
  );

  const markIntroSeen = useCallback(() => {
    writeBoolFlag(sessionStorage, ONE_CLICK_BET_INTRO_SEEN_KEY);
    setHasSeenIntro(true);
  }, []);

  const setAcceptOddsChange = useCallback((value: boolean) => {
    setAcceptOddsChangeState(value);
    try {
      localStorage.setItem(ONE_CLICK_BET_ODDS_ACCEPTED_KEY, value ? '1' : '0');
    } catch {
      // Storage unavailable — value still holds for this page view.
    }
  }, []);

  const markSetupComplete = useCallback(() => {
    writeBoolFlag(localStorage, ONE_CLICK_BET_SETUP_COMPLETE_KEY);
    setHasCompletedSetup(true);
  }, []);

  const saveConfiguration = useCallback(
    (config: { amount?: string; acceptOddsChange?: boolean }) => {
      if (config.amount !== undefined) setQuickBetAmount(config.amount);
      if (config.acceptOddsChange !== undefined) {
        setAcceptOddsChange(config.acceptOddsChange);
      }
    },
    [setQuickBetAmount, setAcceptOddsChange],
  );

  const requestSetup = useCallback(() => {
    // Placeholder — see OneClickBetOnboardingBoundary doc above.
  }, []);
  const resumeInterruptedIntent = useCallback(() => {
    // Placeholder — see OneClickBetOnboardingBoundary doc above.
  }, []);

  const readiness = computeOneClickBetReadiness({
    hasSeenIntro,
    hasCompletedSetup,
  });

  const boundary: OneClickBetOnboardingBoundary = {
    markIntroSeen,
    requestSetup,
    saveConfiguration,
    markSetupComplete,
    resumeInterruptedIntent,
  };

  return {
    hasSeenIntro,
    hasCompletedSetup,
    quickBetAmount,
    setQuickBetAmount,
    acceptOddsChange,
    setAcceptOddsChange,
    readiness,
    markIntroSeen,
    markSetupComplete,
    saveConfiguration,
    boundary,
  };
}
