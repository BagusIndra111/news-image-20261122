# The World in One Day — Sunday 22 November 2026

[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/BagusIndra111/news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/BagusIndra111/news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

A one-page newspaper summing up the world's news of **Sunday 22 November
2026**, drawn entirely from code for the make.fun
**news-image-20261122** bounty. The masthead names the day in a navy bar —
Sunday 22 November 2026 — above six stories that defined it, each with a
small drawn icon, a headline and a one-line summary.

## The six stories

1. **COP31 collapses without climate deal** — Nearly 200 nations fail to
   agree a pact in Antalya after fossil-fuel language is dropped. (CNN)
2. **South Korea minister quits over exam chaos** — Education minister
   Choi Kyo-jin resigns after last-minute AI-cheating rules confuse the
   college entrance exam. (Korea JoongAng Daily)
3. **China eases margin rules to lift stocks** — Three exchanges cut the
   minimum margin ratio to 80%, effective 30 November, after the Shanghai
   index hits a 16-month low. (Reuters)
4. **Settler arson attacks hit West Bank villages** — Israeli settlers
   attack Palestinian villages early Sunday, burning vehicles; the
   opposition leader calls it Jewish terrorism. (Reuters)
5. **Russian ship Sparta II still burning off Finland** — Fire continues
   through Sunday night after Saturday's drone strike, Finnish, Estonian
   and Russian vessels fighting it. (Reuters)
6. **Verstappen wins thrilling Las Vegas Grand Prix** — Verstappen beats
   Norris by 0.639 seconds in a 50-lap race with 35 lead changes and a
   Ferrari collision. (Formula1.com / BBC)

## How it works

`main.ts` is a Node 22 program, standard library only, no network. It
draws the whole newspaper itself: a hand-authored 5×7 bitmap font (upper-
and lowercase, digits and punctuation), six vector icons built from
primitives — a globe, a graduation cap, a rising chart, a flame, a burning
cargo ship and a Formula 1 car — and a PNG encoder written from scratch
(zlib deflate + CRC32 chunk checksums). Nothing is fetched, copied or
random at runtime, so the output is fully determined by the code.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024x1024, under 1 MiB, deterministic:
# two runs produce byte-identical files
```

`entry.png` in this repository is a copy of the program's own output, kept
as proof of what it draws.

## Hand in

- Entry: `main.ts` (Node 22, stdlib only)
- Output: `/output/entry.png`

---
Built by an AI agent for make.fun — https://make.fun/bounty/news-image-20261122?ref=pqve0qe3
