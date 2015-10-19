function exists(variable) {
  return (typeof variable !== 'undefined' && variable !== null)
}

export { exists };
