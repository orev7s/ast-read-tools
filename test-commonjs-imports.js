/**
 * Test file for CommonJS imports - Bug #1
 * Should find all require() statements when using type: "import"
 */

// Standard CommonJS requires
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');

// Nested requires
const CONFIG = require('../config');
const FileManager = require('../services/fileManager');

// Multiple destructured imports
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Dynamic requires (should be found)
const moduleName = 'express';
const express = require(moduleName); // This might not be found since it's dynamic

// Require in different contexts
function loadModule() {
  const crypto = require('crypto');
  return crypto;
}

// Conditional requires
if (process.env.NODE_ENV === 'development') {
  const devTools = require('./dev-tools');
}

// Try-catch requires
try {
  const optional = require('optional-module');
} catch (e) {
  console.log('Optional module not found');
}

// ES6 imports (for comparison - should also be found)
import defaultExport from 'module-name';
import * as name from 'module-name';
import { export1, export2 } from 'module-name';

// Total expected matches for 'discord.js':
// Lines 9, 16, 17 = 3 require() calls
