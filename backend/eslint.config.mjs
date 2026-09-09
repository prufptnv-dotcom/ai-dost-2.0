// eslint.config.mjs
import js from "@eslint/js";
export default [
  { languageOptions: { ecmaVersion: 2022, sourceType: "module" } },
  js.configs.recommended,
  { rules: { "no-console": "off", "no-unused-vars": "warn" } }
];
