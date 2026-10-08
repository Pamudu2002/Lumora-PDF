import { mockConvertFileSrc, mockIPC, mockWindows } from "@tauri-apps/api/mocks";

interface EventPluginInternals {
  unregisterListener?: (event: string, eventId: number) => void;
}

/**
 * Installs Tauri mocks for tests that run outside Tauri: the main window, Windows-style
 * `convertFileSrc`, events, and an IPC handler (by default every command returns nothing).
 */
export function installTauriMocks(
  handler: (cmd: string, args?: unknown) => unknown = () => undefined,
) {
  mockWindows("main");
  mockConvertFileSrc("windows");
  mockIPC(handler, { shouldMockEvents: true });
  // The event mock has no unregisterListener, which `unlisten()` calls on unmount.
  const w = window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: EventPluginInternals };
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ ??= {};
  w.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener ??= () => undefined;
}
