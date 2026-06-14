import { useEffect, useRef, useState } from "react";

export function useMinimumSkeletonTime(
  loading: boolean,
  minimumVisibleMs = 220,
) {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const shownAtRef = useRef<number>(loading ? Date.now() : 0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (!showSkeleton) {
        shownAtRef.current = Date.now();
        setShowSkeleton(true);
      }
      return;
    }

    if (!showSkeleton) {
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minimumVisibleMs - elapsed);
    hideTimerRef.current = window.setTimeout(() => {
      setShowSkeleton(false);
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [loading, minimumVisibleMs, showSkeleton]);

  return showSkeleton;
}
