import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarTab = "thumbnails" | "outline" | "search";

interface UiState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  toggleSidebar: () => void;
  /** Opens the sidebar on a tab. */
  showSidebarTab: (tab: SidebarTab) => void;
}

/** Window layout state (sidebar). Remembered between sessions. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarTab: "thumbnails",
      toggleSidebar: () => {
        set((s) => ({ sidebarOpen: !s.sidebarOpen }));
      },
      showSidebarTab: (tab) => {
        set({ sidebarOpen: true, sidebarTab: tab });
      },
    }),
    { name: "lumora.ui", version: 1 },
  ),
);
