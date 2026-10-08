import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "src/lib/ipc/bindings.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/consistent-type-imports": "error",
      // Design rule: no raw hex colors in components; use tokens (var(--brand), bg-brand, …).
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Use a design token (Tailwind token class or var(--token)) instead of a raw hex color.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Use a design token (Tailwind token class or var(--token)) instead of a raw hex color.",
        },
      ],
    },
  },
);
