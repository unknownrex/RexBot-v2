# RexBot-v2

A simple Node.js WhatsApp bot built on [Baileys v7](https://github.com/WhiskeySockets/Baileys). Converts media to stickers, stickers back to images, and adds a few fun/utility commands.

Product spec: [`docs/PRD.md`](docs/PRD.md)

## Features

- `.s` / `.sticker` — convert an image, GIF, or video into a sticker (send media with the caption, or reply to media). Videos are clipped to `MAX_VIDEO_SECONDS` (default 6 s).
- `.toimg` / `.img` — convert a sticker back into an image (reply to the sticker). Static → PNG, animated → GIF.
- `.dice [sides]` — roll a die (rendered image).
- `.coin` — heads or tails.
- `.random [min] [max]` — random integer (default 1–100).
- `.avatar @user` / `.pp` — fetch the tagged user's profile picture (group & private; falls back to the replied user, or yourself).
- `.ginfo` — group info (groups only).
- `.ping` — liveness check.
- `.help` — list all commands.

## Requirements

- Node.js >= 20
- A phone with WhatsApp (used once, to scan the sign-in QR)

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults work fine
node src/index.js
```

Scan the QR code shown in the terminal with WhatsApp (Linked Devices). The session is saved in `auth/` and reused on restart.

## Config (env)

| Variable | Default | Description |
|---|---|---|
| `PREFIX` | `.` | Command prefix |
| `BOT_NAME` | `RexBot` | Name shown in the WhatsApp browser session |
| `PACK_NAME` | `RexBot` | Sticker pack name embedded in created stickers |
| `PACK_PUBLISHER` | `RexBot Team` | Sticker pack publisher |
| `MAX_VIDEO_SECONDS` | `6` | Max length of a video converted to a sticker |
| `COOLDOWN_MS` | `3000` | Per-command cooldown |
| `FFMPEG_TIMEOUT_MS` | `30000` | ffmpeg job timeout |

## Project layout

```
src/
|- index.js          entry: auth, socket, events, reconnect
|- config.js         env + defaults
|- logger.js         pino
|- handler.js        message router + dispatch + cooldowns
|- lib/              media.js, sticker.js, ffmpeg.js, exif.js, jid.js, reply.js
|- commands/         index.js (registry), sticker.js, games.js, profile.js, group.js, misc.js
```

## Deployment

```bash
npm install && node src/index.js
```

Persist with `pm2` or `systemd`. Delete `auth/` and restart to link a different WhatsApp account.

## Notes / risks

- Uses an unofficial WhatsApp API — heavy or spammy usage can get an account warned/banned. Cooldowns are enabled by default.
- Baileys v7 is ESM-only; this project is plain JavaScript with `import`. No build step.
- Media is processed in `temp/` and cleaned up after each request. `auth/`, `temp/`, `node_modules/`, and `.env` are gitignored.