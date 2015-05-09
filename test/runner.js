// Polyfills for for PhantomJS:
if(typeof Function.prototype.bind === undefined) {
  Function.prototype.bind = require('function-bind');
}
require('promise');

require('./auth')
