/* ============================================================ */
/*  Haptics                                                      */
/* ============================================================ */
/*  Tiny helper around the Vibration API. Two patterns:          */
/*                                                                */
/*    playSelectionHaptic()      — light 10ms tick. Fires on     */
/*                                  every pick add/remove.        */
/*    playTierCrossingHaptic()   — medium 20ms thump. Fires the  */
/*                                  moment cumulative odds cross  */
/*                                  a tier boundary (T0→T1, etc.) */
/*                                                                */
/*  Platform behavior                                            */
/*    Android Chrome / Edge / Samsung Internet: navigator.vibrate */
/*                works. User feels a real haptic.                */
/*    iOS Safari:  navigator.vibrate is NOT implemented; calls    */
/*                are silent no-ops. Apple has never shipped a    */
/*                Web Haptics API.                                */
/*    Desktop:    no-op (no vibration motor).                     */
/*                                                                */
/*  Flutter porting reference (this prototype is a POC for the    */
/*  Flutter mobile app):                                          */
/*    playSelectionHaptic()    → HapticFeedback.selectionClick()  */
/*    playTierCrossingHaptic() → HapticFeedback.mediumImpact()    */
/*                                                                */
/*  Reduced-motion: callers may want to gate on                   */
/*  matchMedia('(prefers-reduced-motion: reduce)') — left to the  */
/*  caller so this module stays a thin wrapper.                   */
/* ============================================================ */

import { buttonProgressionConfig } from './buttonProgressionConfig';

/** Light 10ms tick — selection click (add or remove a pick). */
export function playSelectionHaptic(): void {
  // MASTER SWITCH — silenced with the rest of the progression system when
  // animations are disabled. See cfg.animationsEnabled.
  if (!buttonProgressionConfig.animationsEnabled) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  // 10ms is the canonical Material "selection click" duration. Long
  // enough to register on Android haptic actuators, short enough that
  // a user can tap rapidly without feeling stacked vibrations.
  navigator.vibrate(10);
}

/** Medium 20ms thump — tier crossing (T0↔T1, T1↔T2, etc.). */
export function playTierCrossingHaptic(): void {
  // MASTER SWITCH — see cfg.animationsEnabled.
  if (!buttonProgressionConfig.animationsEnabled) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  // Roughly twice as long as the selection tick so the boundary
  // feels distinct from the surrounding selection clicks.
  navigator.vibrate(20);
}
