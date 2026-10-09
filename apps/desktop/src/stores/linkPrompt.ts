import { create } from "zustand";

interface LinkPromptState {
  /** The external link waiting for the user's confirmation. */
  url: string | null;
  ask: (url: string) => void;
  dismiss: () => void;
}

/** External links open only after the user confirms them in a dialog. */
export const useLinkPromptStore = create<LinkPromptState>()((set) => ({
  url: null,
  ask: (url) => {
    set({ url });
  },
  dismiss: () => {
    set({ url: null });
  },
}));
