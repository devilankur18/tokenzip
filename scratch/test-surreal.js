import { Surreal } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';

async function test() {
  console.log('Starting test...');
  const db = new Surreal({ engines: createNodeEngines() });
  console.log('Connecting to surrealkv:/tmp/test.db...');
  await db.connect('surrealkv:/tmp/test.db');
  console.log('Connected!');
  await db.use({ namespace: 'test', database: 'test' });
  console.log('Using test/test');
  await db.query('CREATE user SET name = "bob";');
  console.log('Created user');
  const res = await db.query('SELECT * FROM user;');
  console.log('Result:', res);
  await db.close();
  console.log('Closed');
}

test().catch(console.error);
