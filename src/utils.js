function exists(variable) {
  return (typeof variable !== 'undefined' && variable !== null)
}

export { exists };

// if (!exists(window) && !exists(window.console)) {
//   let proxiedConsole = {},
//       methodsForLogging = ['log', 'info', 'error'];
//   methodsForLogging.forEach(function(method) {    
//     proxiedConsole[method] = Function.prototype
//   });
// }

// export { proxiedConsole as console };

// export console
//   exists: exists,
//   console: (exists(console) ? console : proxiedConsole)
// };
