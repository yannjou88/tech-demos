在线打开 / Open live: https://gold-15min-odds.yannjou88.workers.dev

# 十五分钟涨跌

只读看板，给一位交易员看黄金或白银：接下来这 15 分钟，Polymarket 上的价格更偏向涨还是跌。不下单，不连接钱包，也不需要登录。

界面是简体中文，附有英文小字。时间用吉隆坡（Asia/Kuala_Lumpur）。服务端读取 Polymarket 的公开接口：Gamma 用来找到当前的 15 分钟市场，CLOB 订单簿用来算上涨 / 下跌概率，公开的现货 K 线用来画本轮走势。页面大约每 10 秒刷新一次。如果没有进行中的回合，或者接口失败，整块看板会自动换成演示数据，并标出「演示数据 / Demo data」。

仅供参考，不构成投资建议。

## 运行

```bash
cd apps/gold-15min-odds
bun install
bun run dev
```

浏览器打开 http://localhost:3000 。逻辑测试：`bun test`。

# 15-minute gold and silver odds

A read-only board for one trader: is the active Polymarket 15-minute gold or silver market priced to finish up or down? There is no betting, wallet, or login.

Labels are Simplified Chinese with short English sublabels. Times use Asia/Kuala_Lumpur. The server reads Polymarket's public APIs: Gamma finds the current 15-minute market, the CLOB order book supplies the up/down odds, and public spot candles draw the round. The page polls about every 10 seconds. If no round is active or a request fails, the whole board switches to a demo feed and shows a Demo data badge.

For information only, not investment advice.

## Run

```bash
cd apps/gold-15min-odds && bun install && bun run dev
```

Tests: `bun test`.
