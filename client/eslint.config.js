import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),

  {
    files: ['**/*.{ts,tsx}'],

    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
      /**
       *  RELAXED RULES 
       */
      '@typescript-eslint/no-explicit-any': 'off', // allow any for now
      '@typescript-eslint/no-unused-vars': 'warn', // don’t break build
      '@typescript-eslint/ban-ts-comment': 'off',

      /**
       * ⚛️ React-friendly tweaks
       */
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * General sanity 
       */
      'no-console': 'off', // allow console logs for dev
      'no-debugger': 'warn',
    },
  },
])