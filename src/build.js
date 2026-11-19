// Build: inline CSS + JS modules into a single self-contained HTML file.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const OUT = path.join(__dirname, '..', 'cardstrike.html'); // build: node src/build.js (from repo root)

const jsFiles = ['config.js', 'cards.js', 'engine.js', 'ai.js', 'meta.js', 'ui.js', 'battle.js', 'main.js'];
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const js = jsFiles.map((f) => '/* ==== ' + f + ' ==== */\n' + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');

const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log('built', OUT, (html.length / 1024).toFixed(1) + ' KB');
