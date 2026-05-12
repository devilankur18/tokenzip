import { SurrealStore } from './dist/index.js';
import path from 'path';

const dbPath = path.resolve('/tmp/express-bench-2/.tokenzip/db');
const conn = `surrealkv://${dbPath}`;
console.log(`Testing connection to: ${conn}`);

const store = new SurrealStore(conn);
try {
  await store.initialize();
  console.log('Success!');
  await store.close();
} catch (err) {
  console.error('Failed:', err);
}
