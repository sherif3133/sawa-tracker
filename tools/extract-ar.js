/* Lists the Arabic text in the tracker (front end + server messages) for translation: node tools/extract-ar.js */
const fs = require('fs');
const path = require('path');
const out = new Set();
const re = /'((?:[^'\\n]|\.)*)'|"((?:[^"\\n]|\.)*)"/g;
for (const f of ['assets/app.js', 'includes/class-rest.php', 'includes/class-rest-social.php', 'includes/class-social.php', 'includes/class-game.php', 'includes/class-xp.php']) {
	const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
	let m;
	while ((m = re.exec(s))) { const t = m[1] !== undefined ? m[1] : m[2]; if (/[؀-ۿ]/.test(t)) out.add(t); }
}
fs.writeFileSync(path.join(__dirname, 'ar-strings.json'), JSON.stringify([...out], null, 1));
console.log(out.size);
