import { useEffect } from "react";
import { onSearchProgress } from "@/lib/ipc";
import { useSearchStore } from "@/stores/search";

/** Feeds search progress events from the Rust side into the search store. */
export function useSearchEvents() {
  const receive = useSearchStore((s) => s.receive);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    onSearchProgress(receive)
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [receive]);
}
