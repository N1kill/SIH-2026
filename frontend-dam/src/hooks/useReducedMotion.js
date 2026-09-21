import { useMediaQuery } from './useMediaQuery';

/**
 * Hook to detect if the user has requested reduced motion for accessibility
 * @returns {boolean} prefersReducedMotion
 */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export default useReducedMotion;
