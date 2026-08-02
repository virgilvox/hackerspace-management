// ESLint 9 flat config. `eslint-config-next` ships a flat-config array
// (core-web-vitals + typescript rules + the Next plugin), which we spread and
// then tune. Run with `pnpm run lint`.
import next from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default [
  {
    // Build output, deps, generated artifacts, and non-source assets. Keeping
    // the generated Supabase types out of lint is deliberate: it is a codegen
    // artifact (see the banner in types/database.ts), not hand-authored source.
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      'types/database.ts',
      'public/**',
      'scripts/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  ...next,

  {
    // Register the TS plugin in the same object the rule overrides live in
    // (flat-config requirement) so these tunings apply on top of ...next.
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // Unused vars are worth surfacing but should not fail CI on a leading-
      // underscore throwaway (destructured rest, intentionally-ignored args).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // `any` is discouraged but still present in a few typed-boundary spots
      // (documented Supabase client seams). Warn so it is visible without
      // blocking, and drive the count down over time rather than all at once.
      '@typescript-eslint/no-explicit-any': 'warn',

      // eslint-config-next@16 turns on eslint-plugin-react-hooks v6's new
      // React-Compiler rule set as errors. They surface genuine modernization
      // debt (e.g. `static-components` catches the members-client field-in-
      // render remount bug, fixed during the members refactor), but most flag
      // patterns that are correct today (data-loading setState in an effect).
      // Keep them as visible warnings rather than CI-blocking errors and burn
      // them down incrementally.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]
