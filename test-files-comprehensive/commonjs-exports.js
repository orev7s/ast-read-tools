// CommonJS export tests
const myFunction = () => console.log('hello');
const myVariable = 42;

// Different export patterns
module.exports = {
  myFunction,
  myVariable,
  inlineFunction: function() { return 'inline'; }
};

// Individual exports
exports.singleExport = 'single';
module.exports.anotherExport = 'another';

// Direct function export
module.exports = function mainExport() {
  return 'main';
};