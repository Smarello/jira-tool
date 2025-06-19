#!/usr/bin/env node

/**
 * Script to check available Drizzle Kit commands
 * Following Clean Code: Utility script, clear output
 */

import { execSync } from 'child_process';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}=== ${message} ===${colors.reset}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function checkDrizzleCommands() {
  logHeader('Drizzle Kit Commands Check');
  
  try {
    // Check Drizzle Kit version
    const version = execSync('npx drizzle-kit --version', { encoding: 'utf8' });
    logSuccess(`Drizzle Kit version: ${version.trim()}`);
  } catch (error) {
    logError('Failed to get Drizzle Kit version');
  }
  
  try {
    // Get help output to see available commands
    const help = execSync('npx drizzle-kit --help', { encoding: 'utf8' });
    
    logHeader('Available Commands');
    log(help);
    
    // Try to extract commands
    const lines = help.split('\n');
    const commandLines = lines.filter(line => 
      line.trim().startsWith('generate') || 
      line.trim().startsWith('push') || 
      line.trim().startsWith('migrate') ||
      line.trim().startsWith('studio') ||
      line.trim().startsWith('up') ||
      line.trim().startsWith('drop')
    );
    
    if (commandLines.length > 0) {
      logHeader('Detected Commands');
      commandLines.forEach(line => {
        log(`  ${line.trim()}`);
      });
    }
    
  } catch (error) {
    logError(`Failed to get help: ${error.message}`);
  }
  
  // Test specific commands
  logHeader('Testing Specific Commands');
  
  const commandsToTest = [
    'generate',
    'generate:sqlite',
    'push',
    'push:sqlite',
    'migrate',
    'up',
    'up:sqlite',
    'studio'
  ];
  
  for (const cmd of commandsToTest) {
    try {
      execSync(`npx drizzle-kit ${cmd} --help`, { encoding: 'utf8', stdio: 'pipe' });
      logSuccess(`Command '${cmd}' is available`);
    } catch (error) {
      log(`❌ Command '${cmd}' is not available`, 'red');
    }
  }
  
  logHeader('Recommendations');
  log('Based on the results above, update your package.json scripts accordingly.');
  log('Common patterns:');
  log('  - For newer versions: generate, push, studio');
  log('  - For older versions: generate:sqlite, push:sqlite, up:sqlite');
}

checkDrizzleCommands();
