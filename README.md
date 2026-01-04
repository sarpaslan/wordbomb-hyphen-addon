# Hyphen Champions

A simple example Word Bomb addon that tracks your hyphenated words and lets you compete with others.

## Features

- Track total hyphens and hyphenated words
- Hyphen streak system with notifications
- Leaderboard to compete with other players
- Best word tracking

## Setup

1. Clone the repository
```bash
git clone https://github.com/sarpaslan/wordbomb-hyphen-addon
cd wordbomb-hyphen-addon
```

2. Install dependencies
```bash
npm install
```

3. Get your addon token
   - Open Word Bomb (https://wordbomb.io)
   - Press **F2** to open the console
   - Type `token` and press Enter
   - Copy your token

4. Create `.env` file
```bash
cp .env.example .env
```

5. Add your token to `.env`
```
ADDON_TOKEN=your_token_here
```

6. Run the addon
```bash
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/hyphens` | View your hyphen stats |
| `/top` | See top hyphen masters |
| `/streak` | View your current hyphen streak |
| `/reset` | Reset your stats |

## How It Works

Every time you submit a word with hyphens:
- Your hyphen count increases
- Your streak continues (resets if you submit a non-hyphenated word)
- If it's your best hyphenated word, you get notified

Streak milestones at 3x, 5x, and 10x trigger chat notifications.

## See Also

- [Word Bomb Addon SDK](https://github.com/sarpaslan/wordbomb-addon) - Create your own addons

## License

MIT
