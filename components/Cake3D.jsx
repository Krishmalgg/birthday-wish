"use client";

import { useEffect, useRef } from "react";

/**
 * Mounts the three.js cake into a square box. three.js is loaded on demand.
 * Breath strength is read every frame from the CSS variables the parent writes
 * on the .cake element (--blow, --p), so no React re-renders while blowing.
 * Calls onFail() if WebGL isn't available, so the drawn cake can stand in.
 */
export default function Cake3D({ candles, number, message, out, hostRef, onReady, onFail }) {
  const boxRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let api = null;

    const readBlow = () => {
      const el = hostRef.current;
      if (!el) return { blow: 0, progress: 0 };
      return {
        blow: parseFloat(el.style.getPropertyValue("--blow")) || 0,
        progress: parseFloat(el.style.getPropertyValue("--p")) || 0,
      };
    };

    import("@/lib/cake3d")
      .then(({ createCake3D }) => {
        if (cancelled || !boxRef.current) return;
        api = createCake3D(boxRef.current, { candles, number, readBlow, message });
        apiRef.current = api;
        onReady?.();
      })
      .catch((err) => {
        console.warn("3D cake unavailable, using the drawn one:", err);
        if (!cancelled) onFail?.();
      });

    return () => {
      cancelled = true;
      api?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, number, message]);

  useEffect(() => {
    apiRef.current?.setOut(Boolean(out));
  }, [out]);

  return <div ref={boxRef} className="cake3d" aria-hidden="true" />;
}
