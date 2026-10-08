import { useEffect, useState } from "react";

/** The current devicePixelRatio, updated when the window moves to a display with another scale. */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const update = () => {
      setDpr(window.devicePixelRatio || 1);
    };
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
    };
  }, [dpr]);

  return dpr;
}
