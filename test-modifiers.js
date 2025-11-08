/**
 * Test file for modifier search functionality
 * Tests the new modifiers parameter for finding functions by async, static, etc.
 */

// Async functions
async function processData() {
  return await fetch('/api/data');
}

const fetchUser = async (id) => {
  return await db.users.findById(id);
};

// Static class methods
class UserService {
  static async findAll() {
    return await db.users.findAll();
  }
  
  static validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  async updateUser(id, data) {
    // Non-static async method
    return await db.users.update(id, data);
  }
  
  deleteUser(id) {
    // Non-static, non-async
    return db.users.delete(id);
  }
}

// Exported functions
export async function handleRequest(req, res) {
  // Exported async function
}

export const processPayment = async (amount) => {
  // Exported const async arrow function
};

// Variable declarations
const API_KEY = 'secret';
let counter = 0;
var oldStyle = true;

// Private/public methods (TypeScript syntax in comments)
class TypeScriptClass {
  // private async fetchInternal() {}
  // public static getInstance() {}
  // protected validateData() {}
}

// Test expectations:
// async functions: 5 total (processData, fetchUser, findAll, updateUser, handleRequest)
// static methods: 2 total (findAll, validateEmail)
// exported functions: 2 total (handleRequest, processPayment)
// const declarations: 2 (API_KEY, processPayment)
