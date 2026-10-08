# Dialog

A modal for decisions that block the work: confirmations, Merge, Split, Compress, Password, Settings.

- **Provide:** a title phrased as the action or question, a body that names the consequence, and footer actions.
- `surface-raised`, `radius-lg`, `shadow-dialog`, over `scrim`. Width 420px for confirms; 560–720px for tool dialogs.
- Footer: secondary actions first, the main action last (right). Destructive main actions use the danger button and the exact verb ("Apply redaction", not "OK").
- Esc and the close button cancel; focus starts on the first field (or the safe action in a confirm) and is trapped inside.
