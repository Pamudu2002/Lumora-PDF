// English strings. Every user-facing string goes through i18next (task 1.18); add new keys here.
// Voice: sentence case, verb + object on buttons, no exclamation marks (brand book).
export const en = {
  app: {
    name: "Lumora PDF",
    internalError:
      "Something went wrong inside Lumora. Your files are safe; if this keeps happening, restart Lumora PDF. Details were saved to the log.",
    dismiss: "Dismiss",
  },
  home: {
    greeting: "Every page, in good light",
    promise: "Every feature is free. Your files open and stay on this device, no account needed.",
    openFile: "Open file",
    dropTitle: "Drop a PDF here",
    opening: "Opening…",
    dropHintBefore: "Or press",
    dropHintAfter: "to browse.",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  errors: {
    malformed: "This file is damaged or isn't a PDF, so Lumora can't open it.",
    fileNotFound: "Lumora can't find this file. It may have been moved or deleted.",
    io: "Lumora couldn't read this file. Check that no other app is using it, then try again.",
    passwordRequired: "This PDF is protected with a password.",
    wrongPassword: "That password is incorrect. Check it and try again.",
    unsupportedSecurity: "This PDF uses security settings that Lumora can't open yet.",
    libraryLoad: "Lumora's PDF engine didn't start. Reinstall Lumora PDF to fix this.",
    fallback: "Something went wrong while opening this file. Try again.",
  },
  viewer: {
    document: "Document",
    pageLabel: "Page {{page}}",
    noPages: "This document has no pages.",
    pageCount_one: "{{count}} page",
    pageCount_other: "{{count}} pages",
    closeFile: "Close file",
  },
  zoom: {
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    actualSize: "Actual size",
    level: "Zoom level {{percent}}%. Reset to 100%",
  },
} as const;

export type Strings = typeof en;
