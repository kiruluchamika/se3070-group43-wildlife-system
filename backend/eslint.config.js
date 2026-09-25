const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: {
      // Express handlers keep the conventional (request, response, next) signature.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(request|response|next|_)' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error'
    }
  },
  {
    files: ['**/*.test.js', 'src/test-support/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node }
  }
]
