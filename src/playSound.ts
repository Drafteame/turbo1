/**
 * playSound — silent no-op hook for future audio design.
 *
 * Adding audio later is a one-line change: replace the no-op body with the
 * real player. Currently every call site below is wired but produces no
 * sound. Defaults to silent per the brief.
 *
 * Hook call sites (search `playSound(` in the codebase):
 *   - 'tier-up'     — fires at every up-tier crossing flourish
 *   - 'tier-down'   — fires at every down-tier crossing
 *   - 'burst'       — fires at the Tier 3 radial burst on selection add
 *   - 'slot-end'    — fires when a slot counter finishes a digit roll
 */
export type SoundEvent = 'tier-up' | 'tier-down' | 'burst' | 'slot-end';

export function playSound(_event: SoundEvent): void {
  // No-op by design. Wire your audio player here when you're ready:
  //
  //   const audio = audioByEvent[_event];
  //   audio?.currentTime = 0;
  //   audio?.play().catch(() => {});
}
