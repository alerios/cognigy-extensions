import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/prefer-for-of': 'error',
      'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
      'no-var': 'error',
      'spaced-comment': ['error', 'always'],
      'no-eval': 'off',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'semi': ['error', 'always'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-trailing-spaces': 'error',
      'brace-style': ['error', '1tbs'],
      'keyword-spacing': 'error'
    }
  },
  {
    ignores: ['build/', 'node_modules/', '**/*.js', '**/*.d.ts']
  }
];
