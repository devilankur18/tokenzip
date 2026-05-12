import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { resolveDbPath } from '../resolve-db.js';
import { execSync } from 'child_process';

export const doctorCommand = new Command('doctor')
  .description('Diagnose and fix common TokenZip issues (like database locks)')
  .option('--fix', 'Attempt to automatically fix issues (e.g., remove stale locks)')
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath } = resolveDbPath(globalOptions.cwd);
    
    console.log(`🏥 TokenZip Doctor — checking ${dbPath}...`);
    
    const lockFile = path.join(dbPath, 'LOCK');
    
    if (fs.existsSync(lockFile)) {
      console.log('⚠️  Found a database LOCK file.');
      
      try {
        // Try to find if any process is using it (works on Mac/Linux)
        const lsof = execSync(`lsof ${lockFile}`).toString();
        console.log('❌ The following process is holding the lock:');
        console.log(lsof);
        
        if (options.fix) {
          console.log('💡 To fix this, you must kill the process listed above.');
          console.log('   Command: kill -9 <PID>');
        }
      } catch (err) {
        // execSync throws if no results found by lsof
        console.log('✅ The lock file exists but no active process was found. It is likely STALE.');
        
        if (options.fix) {
          console.log('🚀 Removing stale lock file...');
          fs.unlinkSync(lockFile);
          console.log('✅ Lock removed. You can now run TokenZip commands.');
        } else {
          console.log('💡 Run `tokenzip doctor --fix` to remove this stale lock.');
        }
      }
    } else {
      console.log('✅ No database lock found.');
    }
    
    console.log('\nIndexing status:');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`- Database directory exists (${stats.size} bytes)`);
    } else {
      console.log('- Database directory not found. Run `tokenzip parse` to index.');
    }
  });
