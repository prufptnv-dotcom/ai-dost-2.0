import { defineConfig, globalIgnores } from "eslint/config";
import { parse, parseForESLint } from "next/dist/compiled/babel/eslint-parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import * as importPlugin from "eslint-plugin-import";
import * as jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import globals from "globals";

const nextBabelParser = { parse, parseForESLint };

const eslintConfig = defineConfig([
  {
    name: "project/react-and-accessibility",
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    languageOptions: {
      parser: nextBabelParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: "module",
        allowImportExportEverywhere: true,
        babelOptions: {
          presets: ["next/babel"],
          caller: { supportsTopLevelAwait: true },
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Preserve the previous Next config's React and accessibility rule levels.
      // The @next/next ruleset is omitted because its transitive fast-glob ->
      // micromatch -> braces chain has an unpatched high-severity advisory.
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "jsx-a11y/alt-text": [
        "warn",
        {
          elements: ["img"],
          img: ["Image"],
        },
      ],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "react/jsx-no-target-blank": "off",
      // Existing project exemptions for legacy rendering/data-loading patterns.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "downloads/**",
  ]),
]);

export default eslintConfig;
