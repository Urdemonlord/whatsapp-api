import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixIndexes() {
  console.log('Connecting to database...');
  
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    console.error('Missing database configuration variables');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    console.log('Fetching indexes for table "users"...');
    const [rows]: any = await connection.execute('SHOW INDEX FROM users');
    
    // Group by Key_name to get full index definition
    const indexDefinitions: Record<string, string[]> = {}; // keyName -> [col1, col2]
    
    rows.forEach((row: any) => {
      const keyName = row.Key_name;
      if (keyName === 'PRIMARY') return;
      if (!indexDefinitions[keyName]) indexDefinitions[keyName] = [];
      // Seq_in_index is 1-based
      indexDefinitions[keyName][row.Seq_in_index - 1] = row.Column_name;
    });

    // Find duplicates based on columns content
    // Map JSON.stringify(columns) -> list of Key_names
    const uniqueDefinitions: Record<string, string[]> = {};

    for (const [keyName, cols] of Object.entries(indexDefinitions)) {
       // Filter out empty slots if any (shouldn't happen with valid indexes)
       const cleanCols = cols.filter(c => c);
       const sig = JSON.stringify(cleanCols);
       
       if (!uniqueDefinitions[sig]) uniqueDefinitions[sig] = [];
       uniqueDefinitions[sig].push(keyName);
    }

    let droppedCount = 0;

    for (const [sig, keyNames] of Object.entries(uniqueDefinitions)) {
      if (keyNames.length > 1) {
         console.log(`Found ${keyNames.length} duplicate indexes for columns ${sig}: ${keyNames.join(', ')}`);
         
         // Keep the one that is shortest or "api_key"?
         // Prefer keeping 'api_key', 'username', 'email' (simple names)
         // Sort prioritization: 
         // 1. Exact match to column name (if single col)
         // 2. Shortest length
         
         const cols = JSON.parse(sig);
         const preferredName = cols.length === 1 ? cols[0] : '';
         
         const sortedKeys = keyNames.sort((a, b) => {
            if (a === preferredName) return -1;
            if (b === preferredName) return 1;
            return a.length - b.length || a.localeCompare(b);
         });

         const keepIndex = sortedKeys[0];
         console.log(`Keeping index: "${keepIndex}"`);

         const toDrop = sortedKeys.slice(1);
         
         for (const indexName of toDrop) {
             console.log(`Dropping redundant index "${indexName}"...`);
             await connection.execute(`DROP INDEX \`${indexName}\` ON users`);
             droppedCount++;
         }
      }
    }
    
    if (droppedCount === 0) {
        console.log('No duplicate indexes found.');
        
        // Debug: Check total count
        const totalIndexes = Object.keys(indexDefinitions).length;
        console.log(`Total non-primary indexes: ${totalIndexes}`);
        if (totalIndexes > 60) {
            console.log('WARNING: Total indexes is critically high even without exact duplicates.');
            // Maybe print them to help user
            console.log('Current indexes:', Object.keys(indexDefinitions));
        }
    } else {
        console.log(`Cleanup complete. Dropped ${droppedCount} redundant keys.`);
    }
    
  } catch (error) {
    console.error('Error during index cleanup:', error);
  } finally {
    await connection.end();
  }
}

fixIndexes();
