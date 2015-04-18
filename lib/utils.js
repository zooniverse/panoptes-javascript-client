var exists = function(variable) {
  return (typeof variable !== 'undefined' && variable !== null)
}

if (!exists(window) && !exists(window.console)) {
  var proxiedConsole = {},
      methodsForLogging = ['log', 'info', 'error'];
  methodsForLogging.forEach(function(method) {    
    proxiedConsole[method] = function() {}
  });
}

module.exports = {
  exists: exists,
  console: (exists(console) ? console : proxiedConsole)
};
