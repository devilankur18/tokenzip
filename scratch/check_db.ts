import { Surreal } from 'surrealdb';

async function check() {
  const db = new Surreal();
  try {
    await db.connect('http://127.0.0.1:33419');
    await db.signin({ username: 'root', password: 'root' });
    await db.use({ namespace: 'tokenzip', database: 'graph' });
    const symbols = await db.query('SELECT name FROM symbol LIMIT 5');
    console.log('Symbols:', JSON.stringify(symbols, null, 2));
    const files = await db.query('SELECT path FROM file LIMIT 5');
    console.log('Files:', JSON.stringify(files, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

check();
