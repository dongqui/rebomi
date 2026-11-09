import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** Shared flat config. Each package re-exports it from its own eslint.config.js. */
export default [
  { ignores: ['**/dist/**', '**/.next/**', '**/.expo/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]
