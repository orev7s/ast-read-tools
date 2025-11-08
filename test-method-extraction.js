/**
 * Test file for method extraction feature
 */

class TestClass {
  /**
   * Constructor for TestClass
   */
  constructor() {
    this.value = 42;
  }

  /**
   * Simple synchronous method
   */
  simpleMethod(param1, param2) {
    return param1 + param2;
  }

  /**
   * Async method for testing
   */
  async asyncMethod(interaction) {
    await this.doSomething();
    return "done";
  }

  /**
   * Private method
   */
  _privateMethod() {
    console.log("Private method called");
  }
}

function topLevelFunction(x, y) {
  return x * y;
}

const arrowFunc = (a, b) => a - b;

module.exports = TestClass;
