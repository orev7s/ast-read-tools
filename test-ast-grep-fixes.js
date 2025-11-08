/**
 * Test script to verify ast-grep fixes
 * Runs the ast-grep tool with various patterns and types to verify bug fixes
 */

const { AstGrepTool } = require('./ast-read-mcp/build/tools/grep.js');

async function runTest(name, params, expectedMinMatches) {
  console.log(`\n=== Test: ${name} ===`);
  console.log('Parameters:', JSON.stringify(params, null, 2));
  
  try {
    const tool = new AstGrepTool();
    const result = await tool.execute(params);
    
    const resultData = typeof result === 'string' ? JSON.parse(result) : result;
    const matchCount = resultData.total_matches || 0;
    
    console.log(`Found ${matchCount} matches (expected at least ${expectedMinMatches})`);
    
    if (matchCount >= expectedMinMatches) {
      console.log('✅ PASS');
    } else {
      console.log(`❌ FAIL - Expected at least ${expectedMinMatches} matches but got ${matchCount}`);
    }
    
    // Show first 3 matches as examples
    if (resultData.matches && resultData.matches.length > 0) {
      console.log('\nFirst 3 matches:');
      resultData.matches.slice(0, 3).forEach(match => {
        console.log(`  - ${match.file}:${match.line} - ${match.match_type}: ${match.name}`);
      });
    }
    
    return { success: matchCount >= expectedMinMatches, matchCount };
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('Starting ast-grep bug fix tests...\n');
  
  const results = [];
  
  // Test #1: CommonJS require() imports (Bug #1)
  console.log('\n========================================');
  console.log('BUG #1: CommonJS require() support');
  console.log('========================================');
  
  results.push(await runTest(
    'Find discord.js CommonJS imports',
    {
      pattern: 'discord\\.js',
      type: 'import',
      path: 'D:\\prjct\\ast-read\\test-commonjs-imports.js',
      output_mode: 'content'
    },
    3  // Expected at least 3 require('discord.js') calls
  ));
  
  results.push(await runTest(
    'Find all CommonJS imports (any require)',
    {
      pattern: '.*',
      type: 'import',
      path: 'D:\\prjct\\ast-read\\test-commonjs-imports.js',
      output_mode: 'content'
    },
    10  // Expected many require() calls
  ));
  
  // Test #2: Function calls (Bug #2)
  console.log('\n========================================');
  console.log('BUG #2: Function call detection');
  console.log('========================================');
  
  results.push(await runTest(
    'Find console.log calls',
    {
      pattern: 'console\\.log',
      type: 'call',
      path: 'D:\\prjct\\ast-read\\test-function-calls.js',
      output_mode: 'content'
    },
    2  // Expected at least 2 console.log calls (lines 7, 32)
  ));
  
  results.push(await runTest(
    'Find all console method calls',
    {
      pattern: 'console\\..*',
      type: 'call',
      path: 'D:\\prjct\\ast-read\\test-function-calls.js',
      output_mode: 'content'
    },
    7  // Expected 7 console.* calls
  ));
  
  results.push(await runTest(
    'Find log/error/warn method calls',
    {
      pattern: 'log|error|warn',
      type: 'call',
      path: 'D:\\prjct\\ast-read\\test-function-calls.js',
      output_mode: 'content'
    },
    5  // Console.log (2), console.error (2), console.warn (1)
  ));
  
  // Test #3: Comprehensive pattern matching (Bug #3)
  console.log('\n========================================');
  console.log('BUG #3: Pattern matching comprehensiveness');
  console.log('========================================');
  
  results.push(await runTest(
    'Find all occurrences of "log" pattern (no type filter)',
    {
      pattern: '.*log.*',
      path: 'D:\\prjct\\ast-read\\test-pattern-matching.js',
      output_mode: 'content'
    },
    25  // Should find many matches including identifiers, strings, etc.
  ));
  
  results.push(await runTest(
    'Find console.* without type filter',
    {
      pattern: 'console\\.(log|error|warn|debug|info)',
      path: 'D:\\prjct\\ast-read\\test-pattern-matching.js',
      output_mode: 'content'
    },
    5  // All console method calls
  ));
  
  // Summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nTotal tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The bugs have been fixed successfully.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the results above.');
  }
}

// Run the tests
runAllTests().catch(console.error);
