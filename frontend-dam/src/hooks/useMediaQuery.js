import { useState, useEffect } from 'react';

/**
 * Custom hook to detect media query matches (responsive breakpoints)
 * 
 * @param {string} query - CSS media query (e.g. '(max-width: 768px)')
 * @returns {boolean} matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', listener);

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}

export default useMediaQuery;
