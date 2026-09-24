import { useState, useEffect, useRef, useCallback } from 'react';

export interface TimelineController {
  currentTime: number;
  maxTime: number;
  isPlaying: boolean;
  speed: number;
  activePhase: string;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  reset: () => void;
  setTime: (t: number) => void;
  setSpeed: (s: number) => void;
  stepForward: () => void;
}

export const TIMELINE_PHASES = [
  { name: 'Flood precautions', time: 0 },
  { name: 'Flood progression', time: 1.0 },
  { name: 'Flood inundation', time: 4.5 },
  { name: 'Flood retention', time: 6.5 },
  { name: 'Flood impact', time: 12.0 },
  { name: 'Flood progression', time: 24.0 },
];

export function useTimelineController(maxTime = 24.0): TimelineController {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastTickRef = useRef<number | null>(null);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const setTime = useCallback((t: number) => {
    setCurrentTime(Math.max(0, Math.min(t, maxTime)));
  }, [maxTime]);

  const stepForward = useCallback(() => {
    setCurrentTime((t) => Math.min(maxTime, t + 1.0));
  }, [maxTime]);

  // Active Phase identification
  let activePhase = 'Flood precautions';
  for (let i = TIMELINE_PHASES.length - 1; i >= 0; i--) {
    if (currentTime >= TIMELINE_PHASES[i].time - 0.2) {
      activePhase = TIMELINE_PHASES[i].name;
      break;
    }
  }

  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;

    const tick = (now: number) => {
      const dtSec = lastTickRef.current == null ? 0 : (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      // 1 real second = speed * 1.5 simulation hours
      const simDt = dtSec * speed * 1.5;

      setCurrentTime((prev) => {
        const next = prev + simDt;
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, speed, maxTime]);

  return {
    currentTime,
    maxTime,
    isPlaying,
    speed,
    activePhase,
    play,
    pause,
    togglePlay,
    reset,
    setTime,
    setSpeed,
    stepForward,
  };
}
