export default [
  {
    files: ['**/*.js'],
    ignores: ['tests/**'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-var': 'error',
    }
  }
];
