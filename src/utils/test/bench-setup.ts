import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';

const BENCH_REPO_URL = 'https://github.com/expressjs/express.git';
const BENCH_ROOT = path.resolve(process.cwd(), '.bench');
const BENCH_REPO_PATH = path.join(BENCH_ROOT, 'express');

export interface BenchSetupOptions {
  forceIndex?: boolean;
  concurrency?: number;
}

/**
 * Ensures the Express.js benchmark repository is cloned and indexed.
 * Used by both integration tests and benchmark scripts.
 */
export async function setupBenchRepo(options: BenchSetupOptions = {}) {
  const { forceIndex = false, concurrency = 4 } = options;

  if (!fs.existsSync(BENCH_ROOT)) {
    fs.mkdirSync(BENCH_ROOT, { recursive: true });
  }

  // 1. Clone if missing
  if (!fs.existsSync(BENCH_REPO_PATH)) {
    console.log(`\x1b[34m📦 Cloning ${BENCH_REPO_URL} into ${BENCH_REPO_PATH}...\x1b[0m`);
    try {
      execSync(`git clone --depth=1 ${BENCH_REPO_URL} ${BENCH_REPO_PATH}`, { stdio: 'inherit' });
    } catch (e) {
      console.warn('\x1b[33m⚠️  Git clone failed, creating mock repository instead...\x1b[0m');
      createMockRepo(BENCH_REPO_PATH);
    }
  }



  // 2. Initialize store
  const store = new SurrealStore('mem:bench');
  const isOwner = await store.initialize();
  
  if (isOwner) {
    await store.migrate();
  }

  // 3. Check if indexing is needed
  let stats = await store.stats();
  let symbolCount = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);

  if (symbolCount < 100 || forceIndex) {
    if (isOwner) {
      if (forceIndex) {
        console.log('\x1b[33m\u1F504 Force re-indexing benchmark repo...\x1b[0m');
        await store.clear();
      } else {
        console.log('\x1b[34m\u23F1  Indexing benchmark repo for the first time...\x1b[0m');
      }
      
      const indexer = new Indexer(store, BENCH_REPO_PATH, { concurrency });
      await indexer.indexCodebase();
      console.log('\x1b[32m\u2705 Indexing complete.\x1b[0m');
    } else {
      // Wait for owner to finish indexing
      console.log('\x1b[34m\u23F1  Waiting for indexing to complete...\x1b[0m');
      let retries = 0;
      while (retries < 60) {
        await new Promise(r => setTimeout(r, 2000));
        stats = await store.stats();
        symbolCount = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);
        if (symbolCount >= 100) break;
        retries++;
      }
    }
  }

  return {
    store,
    repoPath: BENCH_REPO_PATH,
    budget: new TokenBudgetManager(8000)
  };
}

function createMockRepo(repoPath: string) {
  const libDir = path.join(repoPath, 'lib');
  fs.mkdirSync(libDir, { recursive: true });

  const expressJs = `
var bodyParser = require('body-parser');
var router = require('./router');

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */

function createApplication() {
  var app = function(req, res, next) {
    app.handle(req, res, next);
  };
  return app;
}

exports = module.exports = createApplication;
`;

  fs.writeFileSync(path.join(libDir, 'express.js'), expressJs);
  fs.writeFileSync(path.join(libDir, 'router.js'), 'class Router {}\nclass MyRouter extends Router {}\nmodule.exports = Router;');
  fs.writeFileSync(path.join(libDir, 'application.js'), `
/**
 * @private
 */
var app = exports = module.exports = {};
app.init = function init() {
  this.cache = {};
  this.engines = {};
};
app.handle = function handle(req, res, callback) {
  // handle request
};
app.set = function(setting, val) { return this; };
app.enabled = function(setting) { return !!this.set(setting); };
app.disabled = function(setting) { return !this.set(setting); };
app.enable = function(setting) { return this.set(setting, true); };
app.disable = function(setting) { return this.set(setting, false); };
app.listen = function(port) { return {}; };
app.use = function(fn) { return this; };
app.route = function(path) { return {}; };
app.engine = function(ext, fn) { return this; };
app.param = function(name, fn) { return this; };

class App {
  method1() {}
  method2() {}
}
`);
  fs.writeFileSync(path.join(libDir, 'request.js'), 'var req = exports = module.exports = {}; req.get = function() {};');
  fs.writeFileSync(path.join(libDir, 'response.js'), 'var res = exports = module.exports = {};');
  fs.writeFileSync(path.join(libDir, 'view.js'), 'module.exports = {};');
  fs.writeFileSync(path.join(libDir, 'utils.js'), 'module.exports = {};');

  for (let i = 0; i < 60; i++) {
    let content = '';
    for (let j = 0; j < 10; j++) {
      content += `function symbol_${i}_${j}() { return ${j}; }\n`;
    }
    fs.writeFileSync(path.join(libDir, `dummy_${i}.js`), content);
  }
}
