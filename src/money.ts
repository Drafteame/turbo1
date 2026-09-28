/**
 * Shared money-input sanitize/validate helpers. Any monetary text input in
 * this app (currently just the Quick Bet stake field in OnboardingSheet)
 * should reuse these instead of inventing its own regex/format convention.
 *
 * No product-level min/max for a bet amount exists anywhere in this repo
 * (BetSlipFullSheet / BetSlipSheet / ButtonPreviewMomios all hardcode a
 * fixed STAKE=200 display with no bounds) — validation here is
 * intentionally minimal given that absence: reject empty, zero, negative,
 * and non-numeric input. Wire a real min/max once product defines one.
 */

// Strips everything except digits and a single decimal point, capped at 2
// decimal places — matches the Figma placeholder's own "00.00" precision,
// the only existing precedent for this field's expected format. Run this on
// every keystroke AND on paste (React's onChange fires for both), so
// invalid characters and negative signs can never enter the field.
export function sanitizeMoneyInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
    const [intPart, decPart = ''] = cleaned.split('.');
    if (decPart.length > 2) cleaned = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return cleaned;
}

// Empty, "0", "0.00", negative (unreachable via sanitize, but defensive),
// and non-finite values are all invalid. No upper bound — see file header.
export function isValidMoneyAmount(raw: string): boolean {
  if (raw.trim() === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
