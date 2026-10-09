/** Moves keyboard focus to a document's pages (the scroll container marked `data-document-view`). */
export function focusDocumentView(docId: number): void {
  document.querySelector<HTMLElement>(`[data-document-view="${docId}"]`)?.focus();
}

/** Whether a key event is meant for a text field, menu or other widget with its own keys. */
export function isWidgetKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target.closest(
      'input, textarea, select, [role="menu"], [role="menubar"], [role="listbox"], [role="dialog"], [role="tree"], [role="tablist"], [role="slider"], [role="radiogroup"]',
    ) !== null
  );
}
