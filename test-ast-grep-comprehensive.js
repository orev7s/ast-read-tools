#!/usr/bin/env node

/**
 * Comprehensive test suite for ast_grep fixes
 * Tests:
 * 1. CommonJS export detection
 * 2. Function call detection
 * 3. Non-code file searching
 * 4. Arrow function detection
 * 5. Modifiers support
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
const fs = require("fs");

// Colors for output
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// Test directory setup
const TEST_DIR = path.join(__dirname, "test-files-comprehensive");

function setupTestFiles() {
  // Clean and create test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Test File 1: CommonJS exports
  fs.writeFileSync(
    path.join(TEST_DIR, "commonjs-exports.js"),
    `// CommonJS export tests
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
};`
  );

  // Test File 2: Function calls
  fs.writeFileSync(
    path.join(TEST_DIR, "function-calls.js"),
    `// Function call tests
console.log('Testing console.log');
console.error('Testing console.error');

// Simple function calls
fetch('https://api.example.com');
doSomething();

// Method calls
object.method();
deep.nested.method();
array.map(x => x * 2);

// Complex calls
fetchUser({ id: 123 });
processData(await getData());`
  );

  // Test File 3: Markdown file (non-code)
  fs.writeFileSync(
    path.join(TEST_DIR, "README.md"),
    `# Test Documentation

This document contains test patterns for searching.

## Function References
- The \`fetchUser\` function retrieves user data
- Call \`processData\` to process the results
- Use \`module.exports\` for CommonJS

## Code Examples

\`\`\`javascript
function exampleFunction() {
  return 'example';
}
\`\`\`

TODO: Add more examples
FIXME: Update this section`
  );

  // Test File 4: JSON config (non-code)
  fs.writeFileSync(
    path.join(TEST_DIR, "config.json"),
    JSON.stringify({
      name: "test-project",
      scripts: {
        test: "jest",
        build: "webpack"
      },
      dependencies: {
        express: "^4.18.0",
        "module.exports": "1.0.0"  // Test pattern in JSON
      }
    }, null, 2)
  );

  // Test File 5: Arrow functions and modifiers
  fs.writeFileSync(
    path.join(TEST_DIR, "arrow-functions.js"),
    `// Arrow function tests
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
}`
  );

  console.log(`${GREEN}✓ Created test files in ${TEST_DIR}${RESET}`);
}

async function runTest(client, name, toolName, args, validate) {
  try {
    console.log(`\n${BLUE}Running: ${name}${RESET}`);
    const result = await client.request({
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    });

    const passed = validate(result);
    if (passed) {
      console.log(`${GREEN}✓ ${name} passed${RESET}`);
      return true;
    } else {
      console.log(`${RED}✗ ${name} failed${RESET}`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}✗ ${name} failed with error: ${error.message}${RESET}`);
    return false;
  }
}

async function main() {
  console.log(`${BOLD}AST_GREP Comprehensive Test Suite${RESET}`);
  console.log("================================\n");

  // Setup test files
  setupTestFiles();

  // Initialize client
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "ast-read-mcp", "build", "index.js")],
  });

  const client = new Client(
    {
      name: "ast-grep-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  await client.initialize();

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: CommonJS export detection
  const test1 = await runTest(
    client,
    "CommonJS Export Detection (module.exports)",
    "ast_grep",
    {
      pattern: "myFunction",
      type: "export",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "commonjs_export" && 
        m.name === "myFunction"
      );
      if (!found) {
        console.log(`  Expected to find 'myFunction' as commonjs_export`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ type: m.match_type, name: m.name })), null, 2)}`);
      }
      return found;
    }
  );
  results.tests.push({ name: "CommonJS Export Detection", passed: test1 });

  // Test 2: Individual exports detection
  const test2 = await runTest(
    client,
    "CommonJS Individual Exports (exports.x)",
    "ast_grep",
    {
      pattern: "singleExport",
      type: "export",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "commonjs_export" && 
        m.name === "singleExport"
      );
      if (!found) {
        console.log(`  Expected to find 'singleExport' as commonjs_export`);
      }
      return found;
    }
  );
  results.tests.push({ name: "CommonJS Individual Exports", passed: test2 });

  // Test 3: Function call detection
  const test3 = await runTest(
    client,
    "Function Call Detection (fetch)",
    "ast_grep",
    {
      pattern: "fetch",
      type: "call",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "function_call" && 
        m.name === "fetch"
      );
      if (!found) {
        console.log(`  Expected to find 'fetch' as function_call`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ type: m.match_type, name: m.name })), null, 2)}`);
      }
      return found;
    }
  );
  results.tests.push({ name: "Function Call Detection", passed: test3 });

  // Test 4: Method call detection
  const test4 = await runTest(
    client,
    "Method Call Detection (console.log)",
    "ast_grep",
    {
      pattern: "console\\.log",
      type: "call",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "function_call" && 
        m.name.includes("console.log")
      );
      if (!found) {
        console.log(`  Expected to find 'console.log' as function_call`);
      }
      return found;
    }
  );
  results.tests.push({ name: "Method Call Detection", passed: test4 });

  // Test 5: Non-code file search (Markdown)
  const test5 = await runTest(
    client,
    "Non-Code File Search (Markdown)",
    "ast_grep",
    {
      pattern: "fetchUser",
      include_non_code: true,
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const foundInMd = matches.some(m => 
        m.file.endsWith("README.md") && 
        m.match_type === "text_match"
      );
      if (!foundInMd) {
        console.log(`  Expected to find 'fetchUser' in README.md as text_match`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ file: path.basename(m.file), type: m.match_type })), null, 2)}`);
      }
      return foundInMd;
    }
  );
  results.tests.push({ name: "Non-Code File Search", passed: test5 });

  // Test 6: JSON file search
  const test6 = await runTest(
    client,
    "JSON File Search",
    "ast_grep",
    {
      pattern: "express",
      include_non_code: true,
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const foundInJson = matches.some(m => 
        m.file.endsWith("config.json") && 
        m.match_type === "text_match"
      );
      if (!foundInJson) {
        console.log(`  Expected to find 'express' in config.json`);
      }
      return foundInJson;
    }
  );
  results.tests.push({ name: "JSON File Search", passed: test6 });

  // Test 7: Arrow function detection
  const test7 = await runTest(
    client,
    "Arrow Function Detection",
    "ast_grep",
    {
      pattern: "simpleArrow",
      type: "function",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "arrow_function" && 
        m.name === "simpleArrow"
      );
      if (!found) {
        console.log(`  Expected to find 'simpleArrow' as arrow_function`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ type: m.match_type, name: m.name })), null, 2)}`);
      }
      return found;
    }
  );
  results.tests.push({ name: "Arrow Function Detection", passed: test7 });

  // Test 8: Async function detection by modifier
  const test8 = await runTest(
    client,
    "Async Function Detection (by modifier)",
    "ast_grep",
    {
      pattern: ".*",
      type: "function",
      modifiers: ["async"],
      path: path.join(TEST_DIR, "arrow-functions.js"),
    },
    (result) => {
      const matches = result.content?.matches || [];
      const foundAsync = matches.some(m => 
        m.modifiers && m.modifiers.includes("async")
      );
      if (!foundAsync) {
        console.log(`  Expected to find functions with 'async' modifier`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ name: m.name, modifiers: m.modifiers })), null, 2)}`);
      }
      return foundAsync && matches.length >= 2; // Should find at least 2 async functions
    }
  );
  results.tests.push({ name: "Async Function Detection", passed: test8 });

  // Test 9: Static method detection
  const test9 = await runTest(
    client,
    "Static Method Detection",
    "ast_grep",
    {
      pattern: "staticMethod",
      type: "function",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.match_type === "class_method" && 
        m.name === "staticMethod" &&
        m.modifiers && m.modifiers.includes("static")
      );
      if (!found) {
        console.log(`  Expected to find 'staticMethod' with 'static' modifier`);
      }
      return found;
    }
  );
  results.tests.push({ name: "Static Method Detection", passed: test9 });

  // Test 10: Export + async modifier combination
  const test10 = await runTest(
    client,
    "Export + Async Modifier Combination",
    "ast_grep",
    {
      pattern: "exportedArrow",
      type: "function",
      path: TEST_DIR,
    },
    (result) => {
      const matches = result.content?.matches || [];
      const found = matches.some(m => 
        m.name === "exportedArrow" &&
        m.modifiers && 
        m.modifiers.includes("const") &&
        m.modifiers.includes("export")
      );
      if (!found) {
        console.log(`  Expected to find 'exportedArrow' with 'export' and 'const' modifiers`);
        console.log(`  Found: ${JSON.stringify(matches.map(m => ({ name: m.name, modifiers: m.modifiers })), null, 2)}`);
      }
      return found;
    }
  );
  results.tests.push({ name: "Export + Async Modifiers", passed: test10 });

  // Calculate results
  results.passed = results.tests.filter(t => t.passed).length;
  results.failed = results.tests.filter(t => !t.passed).length;

  // Print summary
  console.log(`\n${BOLD}Test Results Summary${RESET}`);
  console.log("====================");
  
  results.tests.forEach(test => {
    const status = test.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${status} ${test.name}`);
  });

  console.log(`\nTotal: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed === 0) {
    console.log(`\n${GREEN}${BOLD}All tests passed! 🎉${RESET}`);
  } else {
    console.log(`\n${RED}${BOLD}Some tests failed. Please review the output above.${RESET}`);
  }

  // Cleanup
  await client.close();
  
  // Clean up test directory
  fs.rmSync(TEST_DIR, { recursive: true });
  console.log(`\n${GREEN}✓ Cleaned up test files${RESET}`);
  
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`${RED}Test suite error:${RESET}`, error);
  process.exit(1);
});
