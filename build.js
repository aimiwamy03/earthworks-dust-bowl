// Inlines src/engine.js into src/app.html and writes index.html (one self-contained page).
const fs = require('fs');
const app = fs.readFileSync(__dirname + '/src/app.html', 'utf8');
const engine = fs.readFileSync(__dirname + '/src/engine.js', 'utf8');
fs.writeFileSync(__dirname + '/index.html', app.replace('/*__ENGINE__*/', engine));
console.log('wrote index.html');
