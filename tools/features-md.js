/* Writes the top-level FEATURES.md from data/roadmap.json (the one source of truth for the feature list,
   the in-app "Feedback & Dev" roadmap and the wp-admin Roadmap page).
   Edit data/roadmap.json (or change statuses in wp-admin → Sawa Tracker → Roadmap and paste its "Export JSON"),
   then run: node tools/features-md.js */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'data', 'roadmap.json');
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'FEATURES.md');
const R = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const PLUGIN = { lens: 'plugin `sawa-lens`, the app at `/app`', tracker: 'plugin `sawa-tracker`, the Play tab', extension: 'browser extension `language-lens`', site: 'plugin `sawa-site`', testimonials: 'plugin `sawa-testimonials`' };
const DONE = ['live', 'beta'];
const cell = (s) => String(s || '').replace(/\|/g, '\\|');
const status = (i) => i.status + (i.note ? ' (' + i.note + ')' : '');
const file = (f) => (f ? f.split(/,\s*/).map((x) => '`' + x + '`').join(', ') : '');

let md = '# Sawa English: everything built so far\n\n'
	+ '<!-- Generated from sawa-tracker/data/roadmap.json by `node sawa-tracker/tools/features-md.js`. Edit the JSON, not this file. -->\n\n'
	+ 'The living list of what students get in each Sawa English app. Students see the same list in the app: **Home → Feedback & Dev → Roadmap**.\n'
	+ '**Last updated: ' + R.updated + '**' + (R.versions ? ' (' + R.versions + ')' : '') + '.\n\n'
	+ 'Decks: **"Sawa English: what you can do"** (the showcase) https://claude.ai/artifact/Kz9QvAF1wGaQSFEMyh6CUR · **"How Language Lens works"** (every button in detail) https://claude.ai/artifact/WCFBSLMn4P42kVgkaKaLy7. Screens of the local test site: `screenshots/showcase-2026-10-22/`.\n\n'
	+ '**Keep it current:** when you ship or plan a feature, add or update its item in `sawa-tracker/data/roadmap.json` (id, app, group, title in plain words, status, version, date, file), then run `node sawa-tracker/tools/features-md.js` and commit the JSON in sawa-tracker. Ideas from students live on the in-app board; link them to a roadmap item by its id.\n\n'
	+ '**Status words**\n'
	+ '- **live**: in the code and deployed to sawaenglish.com. The whole platform is still a beta, and the Sawa App (`/app`) can be closed to students with *Settings → Language Lens → Open the Sawa App to students*.\n'
	+ '- **beta**: built, but marked beta/test in the app, behind a tester list or a setting that is off by default, or waiting for Sherif to try it.\n'
	+ '- **progress** (in progress): being built now. **planned**: decided, not built. **later**: a good idea for some day. **wontdo**: decided against, with the reason.\n\n'
	+ 'Version = the version it first shipped in (later changes in brackets). File = where most of it lives.\n';

Object.keys(R.apps).forEach((app, n) => {
	const rows = R.items.filter((i) => i.app === app && DONE.indexOf(i.status) >= 0);
	if (!rows.length) return;
	md += '\n---\n\n## ' + (n + 1) + '. ' + R.apps[app] + ' (' + PLUGIN[app] + ')\n';
	const groups = [];
	rows.forEach((i) => { if (groups.indexOf(i.group) < 0) groups.push(i.group); });
	groups.forEach((g) => {
		md += '\n' + (g ? '### ' + g + '\n' : '') + '| What the student gets | Status | Version | Date | File |\n|---|---|---|---|---|\n';
		rows.filter((i) => i.group === g).forEach((i) => { md += '| ' + cell(i.title) + (i.audience === 'admin' ? ' *(admins only)*' : '') + ' | ' + cell(status(i)) + ' | ' + cell(i.ver) + ' | ' + (i.date || '') + ' | ' + file(i.file) + ' |\n'; });
	});
});

[['progress', 'In progress now'], ['planned', 'Planned'], ['later', 'Later'], ['wontdo', 'Won\'t do']].forEach(([st, h]) => {
	const rows = R.items.filter((i) => i.status === st);
	md += '\n## ' + h + '\n';
	if (!rows.length) { md += '- Nothing here yet.\n'; return; }
	rows.forEach((i) => { md += '- **' + i.title + '**' + (i.desc ? ': ' + i.desc : '') + ' *(' + R.apps[i.app] + (i.date ? ', ' + i.date : '') + ')*' + (i.file ? ' — `' + i.file + '`' : '') + '\n'; });
});

fs.writeFileSync(OUT, md);
console.log('FEATURES.md:', R.items.length, 'items →', OUT);
