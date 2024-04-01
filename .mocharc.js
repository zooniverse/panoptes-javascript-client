module.exports = {
  reporter: 'spec',
  checkLeaks: true,
  slow: 300,
  require: [
    'test/support/setup.mjs'
  ]
}
