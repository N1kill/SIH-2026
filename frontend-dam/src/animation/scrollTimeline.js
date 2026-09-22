/**
 * PRALAYA Animation Engine — Scroll Timeline Mathematics
 * Pure utility functions for deterministic, smooth interpolation
 * without arbitrary magic offsets scattered in components.
 */

/**
 * Clamps a number between a minimum and maximum value.
 */
export function clamp(val, min = 0, max = 1) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Standard linear interpolation between two values.
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Maps a number from an input domain [inMin, inMax] to an output range [outMin, outMax].
 * By default, clamps the result within the output range.
 */
export function mapRange(value, inMin, inMax, outMin, outMax, shouldClamp = true) {
  if (inMin === inMax) return outMin;
  const progress = (value - inMin) / (inMax - inMin);
  const mapped = outMin + (outMax - outMin) * progress;
  
  if (!shouldClamp) return mapped;
  
  const min = Math.min(outMin, outMax);
  const max = Math.max(outMin, outMax);
  return clamp(mapped, min, max);
}

/**
 * Easing: Ease Out Cubic (decelerates smoothly toward the end)
 */
export function easeOutCubic(t) {
  const p = clamp(t, 0, 1);
  return 1 - Math.pow(1 - p, 3);
}

/**
 * Easing: Ease In Out Quad
 */
export function easeInOutQuad(t) {
  const p = clamp(t, 0, 1);
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

/**
 * Smooth Hermite interpolation between 0 and 1
 */
export function smoothStep(min, max, value) {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}
