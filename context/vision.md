---
last-updated: 2026-05-14
---

# Vision — Follow the Money

---

## Core principle

> "Follow the money." — Capital does not disappear; it rotates.

At any point in time, the sum of all capital in the investable universe is roughly constant. When money leaves one sector, it enters another. The edge belongs to whoever detects that rotation earliest — before the mainstream narrative catches up.

---

## Timeframes are core to the thesis

Institutional rotation does not happen in a single day. It happens over weeks to months. Daily price and flow data are raw inputs; the meaningful unit of decision-making is the monthly trend.

| Timeframe | What lives here | Role |
|-----------|----------------|------|
| Daily | News reactions, block trades, expiry noise | Raw input, diagnostic detail |
| Weekly (~5 days) | Short-term momentum, early rotation hints | Earliest detection layer |
| **Monthly (~20 days)** | **Institutional accumulation cycles, real rotation** | **Default analysis lens** |
| Quarterly (~60 days) | Macro regime shifts, strategic allocation | Strategic rebalancing |
| Yearly (~252 days) | Long-term capital regime shifts | Annual strategy review |

Every signal that can be aggregated across time is computed on multiple timeframes. Default is monthly — that is the timeframe where the "follow the money" thesis is empirically strongest.

---

## Problem statement

Retail investors react to rotation **after** it is visible in price. The typical sequence:

1. Institutional money starts accumulating (quiet, slow)
2. Price begins to diverge from the benchmark
3. Momentum builds, media coverage follows
4. Retail piles in near the top
5. Institutions distribute; price stalls or reverses

We want to operate between steps 1 and 2.

---

## Goals

| Priority | Goal |
|----------|------|
| P0 | Detect statistically meaningful capital rotation across investable categories |
| P0 | Surface which categories are receiving inflows vs. experiencing outflows |
| P1 | Provide actionable portfolio allocation shifts based on rotation signals |
| P1 | Track institutional positioning signals (ETF flows) |
| P2 | Maintain a personal portfolio model and score alignment with current rotation |
| P2 | Alert user when a rotation signal crosses a confidence threshold |
| P3 | Backtest rotation strategies against historical data |

---

## Non-goals

- No trading system or brokerage integration
- No financial advice — all signals are informational
- No individual stock price prediction
- No social / community features

---

## Success metrics

- User identifies which 3 categories are receiving the strongest inflows within 2 clicks
- Rotation signals have measurable lead time over a price-only strategy (validated in M6 backtest)
- User answers "where should I shift my portfolio allocation today?" in under 5 minutes

---

## Guiding principles

1. **Signal clarity over feature volume.** A clean, high-confidence signal beats ten noisy ones.
2. **Local-first.** All data processing on the user's machine. No external service receives portfolio data.
3. **Transparent methodology.** Every signal must display the formula used. No black boxes.
4. **Spec-driven.** All domain knowledge lives in specs. Code follows specs.
