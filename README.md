```
██████╗ ███████╗██╗  ██╗██████╗  ██████╗ ████████╗    ██╗   ██╗██████╗
██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗██╔═══██╗╚══██╔══╝    ██║   ██║╚════██╗
██████╔╝█████╗   ╚███╔╝ ██████╔╝██║   ██║   ██║       ██║   ██║ █████╔╝
██╔══██╗██╔══╝   ██╔██╗ ██╔══██╗██║   ██║   ██║       ╚██╗ ██╔╝██╔═══╝
██║  ██║███████╗██╔╝ ██╗██████╔╝╚██████╔╝   ██║        ╚████╔╝ ███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝         ╚═══╝  ╚══════╝
```

# RexBot V2

A WhatsApp bot for stickers, sound stickers, and small utilities — built on
[Baileys v7](https://github.com/WhiskeySockets/Baileys), plain ESM JavaScript, no build step.

Send media, get a sticker. Send a video with sound and the sticker **plays audio** when tapped.

> ⚠️ Unofficial API. Use it from a number you're willing to risk — see [Notes](#notes).

---

## Highlights

### 🔊 Stickers that make noise

`.ss` builds a sticker whose audio plays on tap. Two ways to feed it:

- **Video with sound** — the clip's own audio track is used automatically.
- **Anything + a replied voice note** — reply to an audio message with any image, GIF, or video.

Audio longer than the animation is trimmed so sound and motion stay in sync, even when the size
budget forces the clip shorter.

### 🎨 Stickers that just work

Every conversion is compressed to fit WhatsApp's real limits — animated stickers under 400 KB,
static under 100 KB — by progressively trading quality, then frame rate, then resolution, and only
cutting length as a last resort. Stickers always arrive downloadable, never as a placeholder with a
broken download button.

### 🧰 Batteries included

Command registry with categories, per-command cooldowns, conversion concurrency limits, consistent
themed replies, and terminal-friendly logging.

---

## Commands

| Command | Aliases | What it does |
|---|---|---|
| `.s` | `.sticker` | Convert an image, GIF, or video into a sticker |
| `.ss` | `.soundsticker` | Sticker that **plays sound** — video track or replied audio |
| `.toimg` | `.img` | Sticker back to image — PNG when static, GIF when animated |
| `.dice` | `.d` | Roll a six-sided die (rendered image) |
| `.coin` | — | Heads or tails |
| `.random [min] [max]` | — | Random integer, default 1–100 |
| `.avatar [@user \| me]` | `.pp` | Fetch a profile picture — mention, reply, or `me` |
| `.ginfo` | — | Group info *(groups only)* |
| `.help` | — | Full command list, grouped by category |

Send media **with** the command as caption, or **reply** to media with the command.

```text
.s      → sticker from the attached photo/video/GIF
.ss     → same, but with sound
.toimg  → reply to a sticker to get the image back
```

---

## Requirements

- **Node.js 22+** (ESM, `import ... with { type: 'json' }`)
- **ffmpeg** — bundled via `ffmpeg-static`, nothing to install
- A phone with WhatsApp, for the one-time QR scan

## Setup

```bash
npm install
cp .env.example .env    # optional, defaults work
npm start
```

Scan the QR printed in the terminal (**WhatsApp → Linked Devices**). Credentials land in `auth/` and
are reused on restart. On launch you'll see:

```text
██████╗ ███████╗██╗  ██╗██████╗  ██████╗ ████████╗    ██╗   ██╗██████╗
██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗██╔═══██╗╚══██╔══╝    ██║   ██║╚════██╗
██████╔╝█████╗   ╚███╔╝ ██████╔╝██║   ██║   ██║       ██║   ██║ █████╔╝
██╔══██╗██╔══╝   ██╔██╗ ██╔══██╗██║   ██║   ██║       ╚██╗ ██╔╝██╔═══╝
██║  ██║███████╗██╔╝ ██╗██████╔╝╚██████╔╝   ██║        ╚████╔╝ ███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝         ╚═══╝  ╚══════╝
     v2.0.0 · prefix . · 9 commands
```

---

## Configuration

Everything is optional — copy `.env.example` to `.env` and edit.

| Variable | Default | Description |
|---|---|---|
| `PREFIX` | `.` | Command prefix |
| `BOT_NAME` | `RexBot` | Name shown in the linked-device list |
| `PACK_NAME` | `RexBot` | Sticker pack name |
| `PACK_PUBLISHER` | `RexBot Team` | Sticker pack publisher |
| `MAX_VIDEO_SECONDS` | `10` | Longest animated sticker; hard-clamped to WhatsApp's 10 s limit |
| `SOUND_MAX_SECONDS` | `10` | Longest audio on a static sticker; animated stickers use the clip's own length |
| `COOLDOWN_MS` | `3000` | Per-command cooldown (media commands exempt) |
| `MEDIA_CONCURRENCY` | `4` | Simultaneous conversions; extras queue rather than fail |
| `FFMPEG_TIMEOUT_MS` | `30000` | Per-job ffmpeg timeout |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `LOG_PRETTY` | auto | Pretty in a terminal; set `false` to force JSON |

---

## How it works

```
message ──▶ handler.js        parse prefix, resolve command, cooldown
        ──▶ commands/*.js      download media, call a lib
        ──▶ lib/               convert, then reply
```

| Piece | Responsibility |
|---|---|
| `index.js` | Socket, auth, event wiring, auto-reconnect, banner |
| `handler.js` | Router: parse, cooldown, dispatch, error replies |
| `lib/sticker.js` | WebP pipeline + the size/duration ladder |
| `lib/sound.js` | Ogg Opus encoding, video-track extraction, sound-sticker send |
| `lib/ffmpeg.js` | `ffmpeg-static` spawn wrapper with timeout |
| `lib/limiter.js` | Bounded conversion concurrency |
| `lib/theme.js` | One visual dialect for every reply |
| `lib/media.js` | Download + host validation, media type guards |

### The size ladder

WhatsApp rejects animated stickers over 500 KB and 10 s, which is why oversized ones show a download
button that never resolves. `fitAnimated()` walks an 18-step ladder and takes the first result under
**400 KB**, moving to the next lever only when the current one fails:

1. **Quality** 80 → 25 at 512 px
2. **Frame rate** 11 → 8 → 6 fps
3. **Resolution** 448 → 256 px
4. **Length** 10 → 1 s (last resort only)

Length goes last on purpose: the user asked for a clip, so quality and smoothness are spent first.
Audio is trimmed to the *measured* duration of the encoded WebP, so it stays in sync at every step.

---

## Development

```bash
npm test        # node:test, no framework
```

Tests generate their own ffmpeg fixtures, so no binary assets live in the repo. Covers the protobuf
audio-field patch, Opus trimming, silent-video detection, the size cap, and the sticker helpers.

---

## Notes

- **Unofficial.** Baileys is not Meta-approved. Cooldowns are on by default; don't spam or bulk-send.
- **Sound stickers rely on an undocumented field.** `StickerMessage` carries audio in field 26, patched
  onto the protobuf encoder at runtime. Clients that ignore it show a normal sticker — the audio
  disappears silently, nothing breaks. Animated WebP *with* audio is unverified on every client.
- **No build step.** Plain ESM; `node src/index.js` runs what you wrote.
- **Gitignored:** `auth/`, `temp/`, `node_modules/`, `docs/`, `.env`.
