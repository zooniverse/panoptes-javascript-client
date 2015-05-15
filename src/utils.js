let exists = function(variable) {
  return (typeof variable !== 'undefined' && variable !== null)
}

if (!exists(window) && !exists(window.console)) {
  let proxiedConsole = {},
      methodsForLogging = ['log', 'info', 'error'];
  methodsForLogging.forEach(function(method) {    
    proxiedConsole[method] = Function.prototype
  });
}

module.exports = {
  exists: exists,
  console: (exists(console) ? console : proxiedConsole)
};
