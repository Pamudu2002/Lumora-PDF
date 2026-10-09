import { create } from "zustand";

/** App dialogs that can be opened from menus, toolbars and shortcuts. */
export type AppDialog = "print" | "properties" | "settings";

interface DialogState {
  /** The dialog showing, if any (one at a time). */
  open: AppDialog | null;
  show: (dialog: AppDialog) => void;
  hide: () => void;
}

/** Which app dialog is open. */
export const useDialogStore = create<DialogState>()((set) => ({
  open: null,
  show: (dialog) => {
    set({ open: dialog });
  },
  hide: () => {
    set({ open: null });
  },
}));
