import fs from 'fs';
import path from 'path';

const BENCH_ROOT = path.resolve(process.cwd(), '.bench');
const BENCH_REPO_PATH = path.join(BENCH_ROOT, 'express');

if (!fs.existsSync(BENCH_REPO_PATH)) {
  fs.mkdirSync(BENCH_REPO_PATH, { recursive: true });
}

const libDir = path.join(BENCH_REPO_PATH, 'lib');
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// Minimal express.js to satisfy tests
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

// Create many dummy symbols to satisfy the > 500 count
for (let i = 0; i < 60; i++) {
  let content = '';
  for (let j = 0; j < 10; j++) {
    content += `function symbol_${i}_${j}() { return ${j}; }\n`;
  }
  fs.writeFileSync(path.join(libDir, `dummy_${i}.js`), content);
}

console.log('Mock express repo created.');
