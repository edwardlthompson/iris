import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/target/**",
      "**/coverage/**",
      "**/node_modules/**",
      "examples/**",
      "modules/**",
      "branding/**",
      "packaging/**",
      "apps/phone/www/**",
      "apps/phone/android/**",
      "argus/**",
      "scripts/**",
      "state/**",
      "templates/**",
      "tests/**",
      "briefs/**",
      "config/**",
      "design-tokens/**",
      "LICENSES/**",
      ".agent/**",
      ".cursor/**",
      ".github/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
);
