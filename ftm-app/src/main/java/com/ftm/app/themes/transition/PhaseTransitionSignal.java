package com.ftm.app.themes.transition;

/**
 * The turning points a theme can be at. These names cross the API boundary — the frontend keys its
 * badges off them — so they are an enum rather than free strings, and every consumer switches over
 * the enum so a missing case fails to compile instead of silently scoring nothing.
 */
public enum PhaseTransitionSignal {
  /** Climbing toward the BUY threshold with conviction behind it. */
  APPROACHING_BUY,
  /** Rebuilding from a weak phase — the earliest constructive sign. */
  EARLY_RECOVERY,
  /** In BUY territory but momentum is fading; the breakout may not hold. */
  BREAKOUT_AT_RISK,
  /** Still scoring well while flow turns against it — a topping pattern. */
  DISTRIBUTION
}
