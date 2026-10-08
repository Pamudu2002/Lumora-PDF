import { useEffect, useState } from "react";
import { events } from "@/lib/ipc/bindings";

/**
 * True after the Rust side reports an unexpected internal error (a caught panic). The details are
 * in the log file; the UI only shows a friendly notice. Returns the flag and a dismiss function.
 */
export function useAppErrors(): [boolean, () => void] {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    events.appErrorEvent
      .listen(() => {
        setFailed(true);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return [
    failed,
    () => {
      setFailed(false);
    },
  ];
}
