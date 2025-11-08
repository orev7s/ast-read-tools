/**
 * Test file for comprehensive pattern matching - Bug #3
 * When searching for pattern ".*log.*" without type filter,
 * should find ALL occurrences including console.log, console.error (contains 'log'),
 * logger, logging, etc.
 */

// Console logging methods - ALL should match ".*log.*"
console.log('Starting application');           // Line 9 - matches 'log'
console.error('Error in application');         // Line 10 - 'error' doesn't match but searching for console methods
console.warn('Warning message');                // Line 11 - no 'log' in warn
console.debug('Debug information');             // Line 12 - no 'log' 
console.info('Info message');                   // Line 13 - no 'log'

// Logger object usage
const logger = createLogger();                 // Line 16 - matches 'logger'
logger.info('Application started');            // Line 17 - matches 'logger'
logger.error('Failed to connect');             // Line 18 - matches 'logger'
logger.debug('Debug mode enabled');            // Line 19 - matches 'logger'

// Functions with 'log' in name
function logMessage(msg) {                     // Line 22 - matches 'logMessage'
  console.log(msg);                            // Line 23 - matches 'log'
}

function handleLogin() {                        // Line 26 - matches 'handleLogin'
  // Process login
}

const logData = (data) => {                    // Line 30 - matches 'logData'
  writeToLogFile(data);                        // Line 31 - matches 'writeToLogFile'
};

// Variables with 'log' in name
const loginForm = document.getElementById('login');  // Line 35 - matches 'login' and 'loginForm'
const logLevel = 'debug';                           // Line 36 - matches 'logLevel'
const catalogItems = ['item1', 'item2'];            // Line 37 - matches 'catalog'

// String literals with 'log'
const message = 'Please login to continue';         // Line 40 - string literal 'login'
const errorMsg = 'Failed to write to log file';     // Line 41 - string literal 'log'

// Object properties with 'log'
const config = {
  logToFile: true,                                  // Line 45 - matches 'logToFile'
  logLevel: 'verbose',                              // Line 46 - matches 'logLevel'
  enableLogging: false                              // Line 47 - matches 'enableLogging'
};

// Class with log-related methods
class Logger {                                      // Line 51 - matches 'Logger'
  constructor() {
    this.logFile = 'app.log';                      // Line 53 - matches 'logFile' and string 'app.log'
  }
  
  logError(error) {                                // Line 56 - matches 'logError'
    console.error(error);                          // Line 57 - console.error
  }
  
  logInfo(info) {                                  // Line 60 - matches 'logInfo'
    console.log(info);                             // Line 61 - matches 'log'
  }
}

// Testing various patterns
dialogBox.show();                                  // Line 66 - matches 'dialog'
analogRead(pin);                                   // Line 67 - matches 'analog'
catalogService.getItems();                         // Line 68 - matches 'catalog'

// When searching for ".*log.*" pattern without type filter:
// Should find approximately 30+ matches including:
// - All console.log calls
// - All identifiers containing 'log' (logger, logData, loginForm, etc.)
// - All string literals containing 'log'
// - All function/method names with 'log'
// - Words like 'dialog', 'analog', 'catalog' that contain 'log'
