import { useCallback, useState } from 'react';

/**
 * Quick Bet settings — the smallest reusable, sheet-independent home for
 * values the Quick Bet (long-press) feature needs across components. Right
 * now: just the default stake amount entered in the onboarding sheet
 * (`quickBetAmount`). This repo has no global store/context (App.tsx just
 * lifts plain useState and prop-drills), so a single hook mounted once in
 * App.tsx and passed down is this project's natural equivalent of a
 * "shared settings store" — not a new architecture, the existing one
 * applied to a value that needs to outlive the sheet that collects it.
 *
 * Persisted to localStorage (unlike the onboarding "seen" flag in App.tsx,
 * which intentionally uses sessionStorage) because the product copy itself
 * says the amount will be saved for future bets ("El monto se guardará
 * para estas apuestas") — a durable preference the user sets once, not a
 * one-session flag. Not wired into the real long-press/lightning-bet flow
 * yet (ButtonPreviewMomios/useLongPress still use their own hardcoded
 * STAKE) — this only stores the value for a future iteration to consume.
 *
 * Defaults to the literal string "0" (Task 6.4) — a real displayed digit,
 * not an empty placeholder — since product requires the field to start at
 * zero. `isValidMoneyAmount` in money.ts already treats 0 as invalid
 * (n > 0 required), so this default can never itself satisfy validation;
 * the user must always enter a real amount before continuing. A stale
 * empty string from an earlier session (before this default existed) is
 * normalized to "0" too, so returning users see the same starting state.
 */
export const QUICK_BET_AMOUNT_STORAGE_KEY = 'qb:quick-bet-amount:v1';
const DEFAULT_QUICK_BET_AMOUNT = '0';

function readStoredQuickBetAmount(): string {
  try {
    const stored = localStorage.getItem(QUICK_BET_AMOUNT_STORAGE_KEY);
    return stored && stored.trim() !== '' ? stored : DEFAULT_QUICK_BET_AMOUNT;
  } catch {
    // Storage unavailable (private-mode edge cases) — start at the default.
    return DEFAULT_QUICK_BET_AMOUNT;
  }
}

export function useQuickBetAmount() {
  const [quickBetAmount, setQuickBetAmountState] = useState(
    readStoredQuickBetAmount,
  );

  const setQuickBetAmount = useCallback((value: string) => {
    setQuickBetAmountState(value);
    try {
      localStorage.setItem(QUICK_BET_AMOUNT_STORAGE_KEY, value);
    } catch {
      // Storage unavailable — still works for this page view via React
      // state, it just won't survive a reload.
    }
  }, []);

  return [quickBetAmount, setQuickBetAmount] as const;
}
