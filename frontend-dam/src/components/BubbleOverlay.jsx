import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * BubbleOverlay — High-performance HTML5 Canvas Underwater Particle Emitter
 * 
 * Bubble behavior:
 * - Spawn at bottom / mid depths
 * - Random radius (2px to 16px) with translucent body and luminous rim highlight
 * - Upward velocity with gentle buoyancy acceleration
 * - Sinusoidal horizontal drift / wobble for natural fluid dynamics
 * - Hydrodynamic cursor deflection
 * - Fades out smoothly upon reaching the water surface
 * - Reduced-motion fallback for accessibility
 */
export default function BubbleOverlay({ intensity = 1.0, className = '' }) {
  const canvasRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const mousePos = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio || window.innerWidth;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle Class — Enhanced Density & Fluid Dynamics
    const particleCount = Math.floor(150 * intensity);
    const bubbles = [];

    class Bubble {
      constructor(isInitial = false) {
        this.reset(isInitial);
      }

      reset(isInitial = false) {
        // Varied radii: micro-bubbles to larger buoyant bubbles
        const rand = Math.random();
        if (rand < 0.6) {
          this.radius = (Math.random() * 4 + 2) * window.devicePixelRatio; // Micro bubble
        } else if (rand < 0.9) {
          this.radius = (Math.random() * 6 + 5) * window.devicePixelRatio; // Medium bubble
        } else {
          this.radius = (Math.random() * 10 + 10) * window.devicePixelRatio; // Hero bubble
        }

        this.x = Math.random() * width;
        this.y = isInitial ? Math.random() * height : height + Math.random() * 120;
        this.vy = (Math.random() * 1.8 + 0.8) * window.devicePixelRatio * (0.8 + this.radius / 12);
        this.vx = (Math.random() - 0.5) * 0.5 * window.devicePixelRatio;
        this.wobbleSpeed = Math.random() * 0.045 + 0.02;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleAmp = (Math.random() * 2.2 + 0.8) * window.devicePixelRatio;
        this.alpha = Math.random() * 0.55 + 0.3;
        this.maxAlpha = this.alpha;
        this.blur = Math.random() > 0.5;
      }

      update() {
        this.wobblePhase += this.wobbleSpeed;
        this.x += Math.sin(this.wobblePhase) * this.wobbleAmp + this.vx;
        this.y -= this.vy;

        // Hydrodynamic mouse deflection
        if (mousePos.current.active) {
          const dx = this.x - mousePos.current.x;
          const dy = this.y - mousePos.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140 * window.devicePixelRatio;

          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 3 * window.devicePixelRatio;
            this.x += (dx / dist) * force;
            this.y += (dy / dist) * force * 0.5;
          }
        }

        // Fade out near the top 15% of the viewport (water surface)
        const surfaceThreshold = height * 0.15;
        if (this.y < surfaceThreshold) {
          this.alpha = (this.y / surfaceThreshold) * this.maxAlpha;
        }

        // Reset when floating past surface
        if (this.y < -this.radius * 2 || this.alpha <= 0.02) {
          this.reset(false);
        }
      }

      draw() {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(this.alpha, 1));

        // Outer glow
        const gradient = ctx.createRadialGradient(
          this.x - this.radius * 0.3,
          this.y - this.radius * 0.3,
          this.radius * 0.1,
          this.x,
          this.y,
          this.radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.3, 'rgba(129, 230, 217, 0.55)');
        gradient.addColorStop(0.8, 'rgba(63, 168, 155, 0.25)');
        gradient.addColorStop(1, 'rgba(210, 255, 250, 0.9)');

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Highlight specular reflection crescent
        ctx.beginPath();
        ctx.arc(
          this.x - this.radius * 0.35,
          this.y - this.radius * 0.35,
          this.radius * 0.3,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        ctx.restore();
      }
    }

    // Initialize bubbles
    for (let i = 0; i < particleCount; i++) {
      bubbles.push(new Bubble(true));
    }

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < bubbles.length; i++) {
        bubbles[i].update();
        bubbles[i].draw();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Mouse tracking for deflection
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: (e.clientX - rect.left) * window.devicePixelRatio,
        y: (e.clientY - rect.top) * window.devicePixelRatio,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mousePos.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [intensity, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div
        className={`bubble-overlay-static ${className}`}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(63, 168, 155, 0.15) 0%, transparent 70%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`bubble-overlay-canvas ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
}
