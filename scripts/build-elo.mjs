/**
 * scripts/build-elo.mjs
 * Fetches World Football Elo Ratings (eloratings.net/World.tsv) and maps
 * to ESPN team ids from docs/api-samples/standings.json.
 *
 * Elo TSV columns (tab-separated):
 *   col1: rank, col2: rank again, col3: code (2-3 letter), col4: current rating, ...
 *
 * Run with: node scripts/build-elo.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// ESPN team mapping from standings.json
const standingsPath = join(repoRoot, 'docs', 'api-samples', 'standings.json');
const standings = JSON.parse(readFileSync(standingsPath, 'utf-8'));

// Build ESPN teams list
const espnTeams = [];
for (const group of standings.children) {
  for (const entry of group.standings.entries) {
    espnTeams.push({
      id: entry.team.id,
      name: entry.team.displayName,
      abbr: entry.team.abbreviation,
    });
  }
}

console.log(`ESPN teams: ${espnTeams.length}`);

// Elo code → ESPN team id mapping
// eloratings.net uses FIFA 3-letter codes but with their own abbreviation scheme
// Key: elo TSV code, Value: ESPN team id
const ELO_CODE_TO_ESPN_ID = {
  // Direct obvious mappings
  'ES': '164',   // Spain → ESPN 164
  'AR': '202',   // Argentina → ESPN 202
  'FR': '478',   // France → ESPN 478
  'EN': '448',   // England → ESPN 448
  'BR': '205',   // Brazil → ESPN 205
  'PT': '482',   // Portugal → ESPN 482
  'CO': '208',   // Colombia → ESPN 208
  'NL': '449',   // Netherlands → ESPN 449
  'EC': '209',   // Ecuador → ESPN 209
  'DE': '481',   // Germany → ESPN 481
  'NO': '464',   // Norway → ESPN 464
  'HR': '477',   // Croatia → ESPN 477
  'TR': '465',   // Turkey → ESPN 465 (Türkiye)
  'JP': '627',   // Japan → ESPN 627
  'BE': '459',   // Belgium → ESPN 459
  'UY': '212',   // Uruguay → ESPN 212
  'CH': '475',   // Switzerland → ESPN 475
  'MX': '203',   // Mexico → ESPN 203
  'SN': '654',   // Senegal → ESPN 654
  'PY': '210',   // Paraguay → ESPN 210
  'AT': '474',   // Austria → ESPN 474
  'MA': '2869',  // Morocco → ESPN 2869
  'CA': '206',   // Canada → ESPN 206
  'KR': '451',   // South Korea → ESPN 451
  'AU': '628',   // Australia → ESPN 628
  'DZ': '624',   // Algeria → ESPN 624
  'IR': '469',   // Iran → ESPN 469
  'EG': '2620',  // Egypt → ESPN 2620
  'SE': '466',   // Sweden → ESPN 466
  'UZ': '2570',  // Uzbekistan → ESPN 2570
  'CZ': '450',   // Czechia → ESPN 450
  'CI': '4789',  // Ivory Coast (Côte d'Ivoire) → ESPN 4789
  'JO': '2917',  // Jordan → ESPN 2917
  'CD': '2850',  // Congo DR → ESPN 2850
  'TN': '659',   // Tunisia → ESPN 659
  'ZA': '467',   // South Africa → ESPN 467
  'GH': '4469',  // Ghana → ESPN 4469
  'CV': '2597',  // Cape Verde → ESPN 2597
  'NZ': '2666',  // New Zealand → ESPN 2666
  'HT': '2654',  // Haiti → ESPN 2654
  'IQ': '4375',  // Iraq → ESPN 4375
  'SA': '655',   // Saudi Arabia → ESPN 655
  'PA': '2659',  // Panama → ESPN 2659
  'US': '660',   // United States → ESPN 660
  'BA': '452',   // Bosnia-Herzegovina → ESPN 452
  'QA': '4398',  // Qatar → ESPN 4398
  'CW': '11678', // Curaçao → ESPN 11678 (eloratings uses 'CW')
  'NS': '580',   // Scotland → ESPN 580 (eloratings uses 'NS' for Scotland)
};

// Fetch the TSV
let tsvData;
try {
  const res = await fetch('https://www.eloratings.net/World.tsv', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  tsvData = await res.text();
  console.log(`Fetched TSV: ${tsvData.length} bytes`);
} catch (err) {
  console.error('Failed to fetch TSV:', err.message);
  process.exit(1);
}

// Parse TSV: col0=rank, col1=rank, col2=code, col3=rating
const eloMap = {};
for (const line of tsvData.split('\n')) {
  const parts = line.split('\t');
  if (parts.length < 4) continue;
  const code = parts[2]?.trim();
  const rating = parseInt(parts[3]?.trim(), 10);
  if (code && !isNaN(rating)) {
    eloMap[code] = rating;
  }
}

console.log(`Parsed ${Object.keys(eloMap).length} Elo entries`);

// Build ratings record and approx list
const ratings = {};
const approx = [];
const DEFAULT_ELO = 1450;

for (const team of espnTeams) {
  const eloCode = Object.entries(ELO_CODE_TO_ESPN_ID).find(([, id]) => id === team.id)?.[0];
  if (eloCode && eloMap[eloCode] !== undefined) {
    ratings[team.id] = eloMap[eloCode];
    console.log(`  ${team.name} (${team.id}) → ${eloCode} = ${eloMap[eloCode]}`);
  } else {
    ratings[team.id] = DEFAULT_ELO;
    approx.push(team.id);
    console.warn(`  APPROX: ${team.name} (${team.id}) → ${DEFAULT_ELO}`);
  }
}

console.log(`\nRatings: ${Object.keys(ratings).length} teams, ${approx.length} approx`);

const output = {
  source: 'https://www.eloratings.net/World.tsv',
  asOf: '2026-06-12',
  ratings,
  approx,
};

const outPath = join(repoRoot, 'public', 'data', 'elo-seed.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);
