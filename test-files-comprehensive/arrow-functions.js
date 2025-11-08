// Arrow function tests
const simpleArrow = () => 'simple';
export const exportedArrow = async () => await fetch('/api');

// Async functions
async function asyncFunction() {
  return await Promise.resolve();
}

// Static methods
class MyClass {
  static staticMethod() {
    return 'static';
  }
  
  async asyncMethod() {
    return 'async';
  }
}