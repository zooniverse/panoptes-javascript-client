'use strict';

var exists = function exists(variable) {
  return typeof variable !== 'undefined' && variable !== null;
};

if (!exists(window) && !exists(window.console)) {
  (function () {
    var proxiedConsole = {},
        methodsForLogging = ['log', 'info', 'error'];
    methodsForLogging.forEach(function (method) {
      proxiedConsole[method] = Function.prototype;
    });
  })();
}

module.exports = {
  exists: exists,
  console: exists(console) ? console : proxiedConsole
};