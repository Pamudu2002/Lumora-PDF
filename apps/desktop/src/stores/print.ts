import { create } from "zustand";

interface PrintState {
  /** The print dialog is open. */
  open: boolean;
  show: () => void;
  hide: () => void;
}

/** Whether the print dialog is showing. */
export const usePrintStore = create<PrintState>()((set) => ({
  open: false,
  show: () => {
    set({ open: true });
  },
  hide: () => {
    set({ open: false });
  },
}));
