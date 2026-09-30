import React, { useRef } from 'react';
import type { TimelineController } from '../../hooks/useTimelineController';
import { TIMELINE_PHASES } from '../../hooks/useTimelineController';

interface TimelinePlayerProps {
  controller: TimelineController;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({ controller }) => {
  const {
    currentTime,
    maxTime,
    isPlaying,
    togglePlay,
    stepForward,
    setTime,
  } = controller;

  const trackRef = useRef<HTMLDivElement | null>(null);

  const pct = Math.max(0, Math.min(100, (currentTime / maxTime) * 100));

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setTime(clickPct * maxTime);
  };

  return (
    <div className="timeline-capsule-bar">
      <div className="timeline-capsule-row">
        {/* Play Circle Button (Image 1 & 2: sleek circle outline) */}
        <button
          className="timeline-play-btn"
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Step Forward Button (Image 1 & 2: >| icon) */}
        <button
          className="timeline-step-btn"
          onClick={stepForward}
          title="Step Forward"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Timeline Track & Milestones */}
        <div className="timeline-track-wrapper">
          {/* Floating Time Tooltip Badge (Image 2: T+6.5hr) */}
          <div
            className="timeline-floating-tooltip"
            style={{ left: `${pct}%` }}
          >
            T+{currentTime.toFixed(1)}hr
          </div>

          <div className="timeline-progress-track" ref={trackRef} onClick={handleTrackClick}>
            <div className="timeline-progress-fill" style={{ width: `${pct}%` }} />

            {/* 6 Milestone Dots (Image 1 & 2) */}
            {TIMELINE_PHASES.map((phase, idx) => {
              const nodePct = (idx / (TIMELINE_PHASES.length - 1)) * 100;
              const isPassed = pct >= nodePct - 1.0;
              return (
                <div
                  key={`${phase.name}-${idx}`}
                  className={`timeline-milestone-dot ${isPassed ? 'passed' : ''}`}
                  style={{ left: `${nodePct}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTime((idx / (TIMELINE_PHASES.length - 1)) * maxTime);
                  }}
                />
              );
            })}
          </div>

          {/* Milestone Labels Underneath */}
          <div className="timeline-labels-row">
            {TIMELINE_PHASES.map((phase, idx) => {
              const nodePct = (idx / (TIMELINE_PHASES.length - 1)) * 100;
              const isCurrent = Math.abs(pct - nodePct) < 12;
              return (
                <span
                  key={`${phase.name}-${idx}`}
                  className={`timeline-label-item ${isCurrent ? 'active' : ''}`}
                  style={{ left: `${nodePct}%` }}
                  onClick={() => setTime((idx / (TIMELINE_PHASES.length - 1)) * maxTime)}
                >
                  {phase.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
