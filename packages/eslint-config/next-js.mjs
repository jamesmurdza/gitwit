import baseConfig from "./base.mjs"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Next.js handles its own lint rules via next lint
      // This extends the base with React-specific overrides
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]
