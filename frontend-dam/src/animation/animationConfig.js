/**
 * PRALAYA Animation Engine — Centralized Animation Configuration
 * Governs keyframes, responsive offsets, transform formulas, and scene handoffs
 * for Scene 01 ("The Calm") and transitions to Scene 02 ("The Breach").
 */

import { mapRange, easeOutCubic, easeInOutQuad } from './scrollTimeline';

export const SKETCHFAB_CONFIG = {
  modelId: 'd9869bc3576a4d818c1cb0381b38457f',
  // URL embed parameters optimized for borderless, dark-theme seamless integration
  embedParams: {
    autostart: 1,
    camera: 0,
    transparent: 1,
    ui_theme: 'dark',
    ui_infos: 0,
    ui_watermark: 0,
    ui_controls: 0,
    ui_help: 0,
    ui_settings: 0,
    ui_inspector: 0,
    ui_annotations: 0,
    ui_stop: 0,
    ui_hint: 0,
    dnt: 1,
  },
  getEmbedUrl() {
    const params = new URLSearchParams(this.embedParams).toString();
    return `https://sketchfab.com/models/${this.modelId}/embed?${params}`;
  },
};

export const SCENE_CHECKPOINTS = {
  START: 0.0,
  WRAPPER_SHIFT: 0.25,
  DAM_FOCUS: 0.50,
  TITLE_FADE: 0.75,
  BREACH_TRIGGER: 1.0,
};

/**
 * Calculates dynamic styles for the 3D Dam Wrapper based on normalized progress [0, 1]
 * Expanded to 100% full-viewport window size.
 */
export function getDamWrapperStyle(progress, isMobile = false) {
  if (isMobile) {
    const scale = mapRange(progress, 0, 1, 1.0, 1.15);
    const translateY = mapRange(progress, 0, 1, 0, -4);
    return {
      transform: `translate3d(0%, ${translateY}%, 0) scale(${scale})`,
      transition: 'transform 0.06s linear',
      willChange: 'transform',
    };
  }

  // Full-window cinematic progress behavior:
  // Starts centered and full-bleed across 100vw x 100vh
  // As user scrolls, gently scales up into the dam focal details (scale: 1.0 -> 1.12)
  const scale = mapRange(progress, 0, 1, 1.0, 1.12);
  const translateY = mapRange(progress, 0, 1, 0, -2);
  const rotateY = mapRange(progress, 0, 1, -0.6, 0.6);

  return {
    transform: `translate3d(0, ${translateY}%, 0) scale(${scale}) rotateY(${rotateY}deg)`,
    transition: 'transform 0.05s linear',
    willChange: 'transform',
  };
}

/**
 * Calculates dynamic styles for the Left Hero Content based on normalized progress
 */
export function getHeroContentStyle(progress, isMobile = false) {
  // Title stays crisp from 0% -> 40%, begins fading, drops sharply past 60%, gone by 85%
  let opacity = 1;
  let translateY = 0;
  let blur = 0;

  if (progress <= 0.4) {
    opacity = 1;
    translateY = 0;
    blur = 0;
  } else if (progress <= SCENE_CHECKPOINTS.TITLE_FADE) {
    const t = (progress - 0.4) / (0.75 - 0.4);
    opacity = mapRange(t, 0, 1, 1, 0.2);
    translateY = mapRange(t, 0, 1, 0, -35);
    blur = mapRange(t, 0, 1, 0, 3.5);
  } else {
    const t = (progress - 0.75) / 0.25;
    opacity = mapRange(t, 0, 1, 0.2, 0);
    translateY = mapRange(t, 0, 1, -35, -70);
    blur = mapRange(t, 0, 1, 3.5, 8);
  }

  return {
    opacity,
    transform: `translate3d(0, ${translateY}px, 0)`,
    filter: blur > 0.1 ? `blur(${blur}px)` : 'none',
    pointerEvents: opacity < 0.1 ? 'none' : 'auto',
    transition: 'opacity 0.06s linear, transform 0.06s linear',
    willChange: 'opacity, transform',
  };
}

/**
 * Calculates dynamic styles for the Scroll Indicator
 */
export function getScrollIndicatorStyle(progress) {
  // Visible at start, smoothly fades out by 20% scroll
  const opacity = mapRange(progress, 0, 0.2, 1, 0);
  return {
    opacity,
    pointerEvents: opacity < 0.05 ? 'none' : 'auto',
    transform: `translate3d(0, ${mapRange(progress, 0, 0.2, 0, 12)}px, 0)`,
    transition: 'opacity 0.1s linear',
  };
}

/**
 * Transition overlay effect entering the Breach scene
 */
export function getBreachTransitionAtmosphere(progress) {
  // At 75% -> 100%, an ominous atmospheric mist and amber/deep flood wash enters
  const atmosphereOpacity = mapRange(progress, 0.72, 1.0, 0, 0.78);
  return {
    opacity: atmosphereOpacity,
    pointerEvents: 'none',
  };
}
