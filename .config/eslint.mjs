import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: {
    markdown: 'dprint',
  },
})
  .override('antfu/typescript/rules', {
    rules: {
      'complexity': ['error', 5],
      'no-restricted-syntax': 'off',
    },
  })
