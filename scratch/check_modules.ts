import { SurrealStore } from '../src/storage/surreal/store.js';
const store = new SurrealStore();
await store.connect('http://localhost:11001', 'root', 'root', 'test', 'test');
const res = await store.query('SELECT id, path FROM module WHERE path CONTAINS "lib"');
console.log(JSON.stringify(res, null, 2));
await store.close();
