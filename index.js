const { WordBombAddon } = require('./wordbomb-addon.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const addon = new WordBombAddon(process.env.ADDON_TOKEN, {
  name: 'Hyphen Champions',
  desc: 'Track your hyphenated words and compete with others',
  practice: false,
  welcome: `
    <h3>Hyphen Champions</h3>
    <p>Track your hyphenated words</p>
    <p><b>/hyphens</b> - View your hyphen stats</p>
    <p><b>/top</b> - See top hyphen masters</p>
    <p><b>/streak</b> - View your hyphen streak</p>
    <p><b>/reset</b> - Reset your stats</p>
  `
});

const STATS_FILE = path.join(__dirname, 'stats.json');
let playerStats = new Map();

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      playerStats = new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function saveStats() {
  try {
    const data = Object.fromEntries(playerStats);
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

loadStats();

function getStats(clientId, clientName) {
  if (!playerStats.has(clientId)) {
    playerStats.set(clientId, {
      name: clientName || 'Unknown',
      hyphens: 0,
      hyphenWords: 0,
      bestWord: '',
      streak: 0,
      maxStreak: 0
    });
  }
  const stats = playerStats.get(clientId);
  if (clientName && stats.name !== clientName) {
    stats.name = clientName;
  }
  return stats;
}

function countHyphens(word) {
  return (word.match(/-/g) || []).length;
}

addon.registerCommand('hyphens', (client, args) => {
  const stats = getStats(client.id, client.name);
  const avgHyphens = stats.hyphenWords > 0 ? (stats.hyphens / stats.hyphenWords).toFixed(1) : 0;

  addon.sendEmbed(client.id, {
    icon: '➖',
    title: `${client.name}'s Hyphen Stats`,
    content: [
      `Total Hyphens: ${stats.hyphens}`,
      `Hyphenated Words: ${stats.hyphenWords}`,
      `Avg Hyphens/Word: ${avgHyphens}`,
      `Best Word: ${stats.bestWord || 'None'}`,
      `Best Streak: ${stats.maxStreak}`
    ].join('\n'),
    color: '#8b5cf6'
  });
});

addon.registerCommand('top', (client, args) => {
  const allStats = Array.from(playerStats.entries())
    .map(([id, stats]) => ({
      name: stats.name || 'Unknown',
      hyphens: stats.hyphens || 0,
      bestWord: stats.bestWord || ''
    }))
    .filter(p => p.hyphens > 0)
    .sort((a, b) => b.hyphens - a.hyphens)
    .slice(0, 5);

  if (allStats.length === 0) {
    addon.sendChat(client.id, 'No hyphen stats yet. Type some hyphenated words first.');
    return;
  }

  const list = allStats.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    return `${medal} ${p.name}: ${p.hyphens} hyphens`;
  }).join('\n');

  addon.sendEmbed(client.id, {
    icon: '👑',
    title: 'Hyphen Champions',
    content: list,
    color: '#f59e0b'
  });
});

addon.registerCommand('streak', (client, args) => {
  const stats = getStats(client.id, client.name);

  let message = '';
  if (stats.streak > 0) {
    message = `Current hyphen streak: ${stats.streak} ➖\nBest streak: ${stats.maxStreak}`;
  } else {
    message = `No active streak\nBest streak: ${stats.maxStreak}`;
  }

  addon.sendEmbed(client.id, {
    icon: '➖',
    title: 'Hyphen Streak',
    content: message,
    color: stats.streak >= 5 ? '#8b5cf6' : '#6b7280'
  });
});

addon.registerCommand('reset', (client, args) => {
  playerStats.delete(client.id);
  saveStats();
  addon.sendChat(client.id, 'Your stats have been reset.');
});

addon.on('ready', (id) => {
  console.log('Hyphen Champions addon ready:', id);
});

addon.on('start', (data, client) => {
  const stats = getStats(client.id, client.name);
  stats.streak = 0;
});

addon.on('submit', (data, client) => {
  if (!data.correct) return;

  const hyphens = countHyphens(data.word);
  if (hyphens === 0) {
    const stats = getStats(client.id, client.name);
    if (stats.streak >= 3) {
      addon.sendChat(client.id, `Hyphen streak ended at ${stats.streak}`);
    }
    stats.streak = 0;
    return;
  }

  const stats = getStats(client.id, client.name);
  stats.hyphens += hyphens;
  stats.hyphenWords++;
  stats.streak++;

  if (stats.streak > stats.maxStreak) {
    stats.maxStreak = stats.streak;
  }

  if (hyphens > countHyphens(stats.bestWord || '')) {
    stats.bestWord = data.word;
    if (hyphens >= 2) {
      addon.sendEmbed(client.id, {
        icon: '👑',
        title: 'New Best Hyphen Word',
        content: `"${data.word}" (${hyphens} hyphens)`,
        color: '#8b5cf6'
      });
    }
  }

  if (stats.streak === 3) {
    addon.sendChat(client.id, '3x streak');
  } else if (stats.streak === 5) {
    addon.sendChat(client.id, '5x streak');
  } else if (stats.streak === 10) {
    addon.sendChat(client.id, '10x streak');
  }

  saveStats();
});

addon.on('end', (data, client) => {
  const stats = getStats(client.id, client.name);
  if (stats.streak >= 3) {
    addon.sendChat(client.id, `Game over. Final hyphen streak: ${stats.streak}`);
  }
});

addon.on('error', (err) => {
  console.error('Addon error:', err);
});
