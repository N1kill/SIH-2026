import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track normalized scroll progress [0, 1] through a container.
 * Uses requestAnimationFrame for fluid 60/120fps performance without scroll jank.
 * 
 * @param {React.RefObject<HTMLElement>} targetRef - The container element to track
 * @returns {object} { progress, rawScrollY, isSticky, isPassed }
 */
export function useScrollProgress(targetRef) {
  const [progress, setProgress] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [isPassed, setIsPassed] = useState(false);
  const rafId = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) return;

      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;

        const target = targetRef?.current;
        if (!target) {
          // Fallback to general window height
          const maxScroll = window.innerHeight * 1.5;
          const currentProgress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
          setProgress(currentProgress);
          return;
        }

        const rect = target.getBoundingClientRect();
        const totalHeight = target.offsetHeight;
        const viewportHeight = window.innerHeight;
        const scrollDistance = totalHeight - viewportHeight;

        if (scrollDistance <= 0) {
          setProgress(0);
          setIsSticky(false);
          setIsPassed(false);
          return;
        }

        // Distance scrolled into the container
        const scrolled = -rect.top;
        const normalized = Math.min(Math.max(scrolled / scrollDistance, 0), 1);

        setProgress(normalized);
        setIsSticky(rect.top <= 0 && rect.bottom >= viewportHeight);
        setIsPassed(rect.bottom < viewportHeight);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    
    // Initial measurement
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId.current) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, [targetRef]);

  return { progress, isSticky, isPassed };
}

export default useScrollProgress;
