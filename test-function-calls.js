/**
 * Test file for function calls - Bug #2
 * Should find all function calls when using type: "call"
 */

// Console method calls (all should be found)
console.log('✅ Bot started successfully');
console.error('❌ Failed to start bot:', error);
console.warn('⚠️ Memory Warning:', message);
console.debug('Debug info');
console.info('Information');

// Nested object method calls
process.env.NODE_ENV;
process.exit(0);
process.on('uncaughtException', handler);

// Regular function calls
myFunction();
calculateTotal(100, 200);
getUserData('userId123');

// Method calls on objects
const user = getUser();
user.save();
user.delete();
user.update({ name: 'New Name' });

// Chained method calls
fetch('/api/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));

// Array method calls
const numbers = [1, 2, 3];
numbers.map(x => x * 2);
numbers.filter(x => x > 1);
numbers.reduce((a, b) => a + b, 0);

// String method calls
const text = 'Hello World';
text.toLowerCase();
text.toUpperCase();
text.split(' ');

// Global functions
parseInt('42');
parseFloat('3.14');
setTimeout(() => {}, 1000);
setInterval(() => {}, 1000);

// Constructor calls
new Date();
new Error('Something went wrong');
new Promise((resolve, reject) => {});

// Callback function calls
someAsyncFunction((err, data) => {
  if (err) handleError(err);
  else processData(data);
});

// Expected console.log matches: lines 7, 31, 32
// Expected console.error matches: lines 8, 32
// Expected console.warn matches: line 9
// Total console.* calls: 7
