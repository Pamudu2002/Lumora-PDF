import { useEffect, useState, type CSSProperties } from "react";

/** Tries before giving up on a tile; each retry waits a little longer. */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 120;

export interface TileImageProps {
  src: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A `lumora://` tile image. The renderer skips tiles of pages that scrolled away (204, no image);
 * if this tile is still on screen when that happens, it asks again.
 */
export function TileImage({ src, className, style }: TileImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failedAt, setFailedAt] = useState(-1);

  useEffect(() => {
    if (failedAt < 0 || failedAt !== attempt || attempt >= MAX_RETRIES) return undefined;
    const timer = setTimeout(
      () => {
        setAttempt(attempt + 1);
      },
      RETRY_DELAY_MS * (attempt + 1),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [failedAt, attempt]);

  return (
    <img
      src={attempt === 0 ? src : `${src}&retry=${attempt}`}
      alt=""
      draggable={false}
      decoding="async"
      className={className}
      style={style}
      onError={() => {
        setFailedAt(attempt);
      }}
    />
  );
}
