/**
 * Test function with JSDoc
 */
function testFunc(param1, param2) {
  return param1 + param2;
}

/**
 * Another test function
 */
const arrowFunc = async (data) => {
  return await processData(data);
};

/**
 * Test class with JSDoc
 */
class TestClass {
  constructor() {
    this.value = 0;
  }

  /**
   * Instance method
   */
  incrementValue() {
    this.value++;
  }

  /**
   * Static method
   */
  static createInstance() {
    return new TestClass();
  }
}

export default TestClass;
export { testFunc, arrowFunc };
