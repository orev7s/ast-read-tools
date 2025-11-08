/**
 * Test script to verify modifier search functionality
 */

const { AstGrepTool } = require('./ast-read-mcp/build/tools/grep.js');

async function testModifiers() {
  console.log('Testing modifier search functionality...\n');
  const tool = new AstGrepTool();
  
  // Test 1: Find all async functions
  console.log('=== Test 1: Find all async functions ===');
  try {
    const result = await tool.execute({
      pattern: '.*',
      type: 'function',
      modifiers: ['async'],
      path: 'D:\\prjct\\ast-read\\test-modifiers.js',
      output_mode: 'content'
    });
    
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    console.log(`Found ${data.total_matches} async functions`);
    if (data.matches) {
      data.matches.forEach(m => {
        console.log(`  - ${m.name} at line ${m.line} (${m.match_type})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 2: Find all static methods
  console.log('\n=== Test 2: Find all static methods ===');
  try {
    const result = await tool.execute({
      pattern: '.*',
      type: 'function',
      modifiers: ['static'],
      path: 'D:\\prjct\\ast-read\\test-modifiers.js',
      output_mode: 'content'
    });
    
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    console.log(`Found ${data.total_matches} static methods`);
    if (data.matches) {
      data.matches.forEach(m => {
        console.log(`  - ${m.name} at line ${m.line} (modifiers: ${m.modifiers?.join(', ')})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 3: Find static async methods (combined modifiers)
  console.log('\n=== Test 3: Find static async methods ===');
  try {
    const result = await tool.execute({
      pattern: '.*',
      type: 'function', 
      modifiers: ['static', 'async'],
      path: 'D:\\prjct\\ast-read\\test-modifiers.js',
      output_mode: 'content'
    });
    
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    console.log(`Found ${data.total_matches} static async methods`);
    if (data.matches) {
      data.matches.forEach(m => {
        console.log(`  - ${m.name} at line ${m.line} (modifiers: ${m.modifiers?.join(', ')})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 4: Find const variables
  console.log('\n=== Test 4: Find const variables ===');
  try {
    const result = await tool.execute({
      pattern: '.*',
      type: 'variable',
      modifiers: ['const'],
      path: 'D:\\prjct\\ast-read\\test-modifiers.js',
      output_mode: 'content'
    });
    
    const data = typeof result === 'string' ? JSON.parse(result) : result;
    console.log(`Found ${data.total_matches} const variables`);
    if (data.matches && data.matches.length > 0) {
      data.matches.slice(0, 5).forEach(m => {
        console.log(`  - ${m.name} at line ${m.line}`);
      });
      if (data.matches.length > 5) {
        console.log(`  ... and ${data.matches.length - 5} more`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n✅ Modifier search tests completed!');
}

testModifiers().catch(console.error);
