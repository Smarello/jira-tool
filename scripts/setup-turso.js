#!/usr/bin/env node

/**
 * Turso setup automation script
 * Following Clean Code: Automation, clear output, error handling
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';


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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function execCommand(command, description) {
  try {
    log(`🔄 ${description}...`);
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    logSuccess(`${description} completed`);
    return output.trim();
  } catch (error) {
    logError(`${description} failed: ${error.message}`);
    throw error;
  }
}

function checkTursoCLI() {
  try {
    execSync('turso --version', { stdio: 'pipe' });
    logSuccess('Turso CLI is installed');
    return true;
  } catch (error) {
    logError('Turso CLI is not installed');
    log('Please install Turso CLI: curl -sSfL https://get.tur.so/install.sh | bash');
    return false;
  }
}

function checkTursoAuth() {
  try {
    execSync('turso auth whoami', { stdio: 'pipe' });
    logSuccess('Turso CLI is authenticated');
    return true;
  } catch (error) {
    logError('Turso CLI is not authenticated');
    log('Please authenticate: turso auth login');
    return false;
  }
}

function createTursoDatabase(dbName) {
  try {
    // Check if database already exists
    const databases = execSync('turso db list', { encoding: 'utf8' });
    if (databases.includes(dbName)) {
      logWarning(`Database ${dbName} already exists`);
      return;
    }

    execCommand(`turso db create ${dbName}`, `Creating database ${dbName}`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      logWarning(`Database ${dbName} already exists`);
    } else {
      throw error;
    }
  }
}

function getTursoDatabaseURL(dbName) {
  try {
    const url = execCommand(`turso db show ${dbName} --url`, `Getting database URL for ${dbName}`);
    return url;
  } catch (error) {
    throw new Error(`Failed to get database URL: ${error.message}`);
  }
}

function createTursoToken(dbName) {
  try {
    const token = execCommand(`turso db tokens create ${dbName}`, `Creating auth token for ${dbName}`);
    return token;
  } catch (error) {
    throw new Error(`Failed to create auth token: ${error.message}`);
  }
}

function updateEnvFile(dbUrl, authToken) {
  const envPath = '.env';
  const envExamplePath = '.env.example';
  
  let envContent = '';
  
  // Read existing .env file or create from example
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8');
    logSuccess('Found existing .env file');
  } else if (existsSync(envExamplePath)) {
    envContent = readFileSync(envExamplePath, 'utf8');
    logSuccess('Created .env from .env.example');
  } else {
    logError('.env.example file not found');
    throw new Error('Cannot create .env file without .env.example template');
  }

  // Update database provider
  envContent = envContent.replace(
    /DATABASE_PROVIDER=.*/,
    'DATABASE_PROVIDER=turso'
  );

  // Update Turso URL
  envContent = envContent.replace(
    /TURSO_DATABASE_URL=.*/,
    `TURSO_DATABASE_URL=${dbUrl}`
  );

  // Update Turso token
  envContent = envContent.replace(
    /TURSO_AUTH_TOKEN=.*/,
    `TURSO_AUTH_TOKEN=${authToken}`
  );

  // Write updated .env file
  writeFileSync(envPath, envContent);
  logSuccess('Updated .env file with Turso configuration');
}

function runMigrations() {
  try {
    // For Drizzle Kit v0.31.1, we use push to create tables directly
    execCommand('npm run db:push', 'Creating database tables');
  } catch (error) {
    logWarning('Database setup failed, but this might be expected for first setup');
    log('You can run database setup manually later with:');
    log('  npm run db:push     # Create tables directly');
    log('Or generate migrations first:');
    log('  npm run db:generate # Generate migration files');
    log('  npm run db:migrate  # Apply migrations');
  }
}

async function setupTurso() {
  logHeader('Turso Database Setup');
  
  const dbName = process.argv[2] || 'jira-tool';
  log(`Database name: ${dbName}`);

  try {
    // Step 1: Check prerequisites
    logHeader('Step 1: Checking Prerequisites');
    if (!checkTursoCLI()) {
      process.exit(1);
    }
    
    if (!checkTursoAuth()) {
      process.exit(1);
    }

    // Step 2: Create database
    logHeader('Step 2: Creating Database');
    createTursoDatabase(dbName);

    // Step 3: Get database URL
    logHeader('Step 3: Getting Database Configuration');
    const dbUrl = getTursoDatabaseURL(dbName);
    log(`Database URL: ${dbUrl}`);

    // Step 4: Create auth token
    const authToken = createTursoToken(dbName);
    log(`Auth token: ${authToken.substring(0, 20)}...`);

    // Step 5: Update .env file
    logHeader('Step 4: Updating Environment Configuration');
    updateEnvFile(dbUrl, authToken);

    // Step 6: Run migrations
    logHeader('Step 5: Running Database Migrations');
    runMigrations();

    // Success message
    logHeader('Setup Complete!');
    logSuccess('Turso database setup completed successfully');
    log('');
    log('Next steps:');
    log('1. Start your application: npm run dev');
    log('2. Test the database integration: npm run test:db:dev');
    log('3. View your database: turso db shell ' + dbName);
    log('');
    log('Your application is now configured to use Turso database!');

  } catch (error) {
    logHeader('Setup Failed');
    logError(`Setup failed: ${error.message}`);
    log('');
    log('Troubleshooting:');
    log('1. Make sure Turso CLI is installed and authenticated');
    log('2. Check your internet connection');
    log('3. Verify you have the necessary permissions');
    log('4. Try running the setup again');
    process.exit(1);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTurso().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

export { setupTurso };
