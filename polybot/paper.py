#!/usr/bin/env python3
"""Paper-trading CLI for Polymarket alerts posted in Discord.

Uses only Polymarket's public data APIs (no keys). Fills are simulated against
the live order book and recorded in ledger.json next to this file.

  python3 polybot/paper.py search "fed rate cut december"
  python3 polybot/paper.py quote <market-slug>
  python3 polybot/paper.py place --slug <slug> --outcome Yes --side buy --usd 50 --limit 0.42 --alert "<text>"
  python3 polybot/paper.py place --slug <slug> --outcome Yes --side sell --shares 100 --limit 0.40 --alert "<text>"
  python3 polybot/paper.py portfolio
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

GAMMA = "https://gamma-api.polymarket.com"
CLOB = "https://clob.polymarket.com"
HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"
LEDGER_PATH = HERE / "ledger.json"


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "polybot-paper/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


def load_config():
    return json.loads(CONFIG_PATH.read_text())


def load_ledger():
    if LEDGER_PATH.exists():
        return json.loads(LEDGER_PATH.read_text())
    return {"cash": load_config()["starting_balance_usd"], "positions": {}, "trades": []}


def save_ledger(ledger):
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2) + "\n")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_list(value):
    return json.loads(value) if isinstance(value, str) else (value or [])


def get_market(slug):
    markets = get_json(f"{GAMMA}/markets?slug={urllib.parse.quote(slug)}")
    if not markets:
        sys.exit(f"No market with slug '{slug}'. Use `search` to find the right slug.")
    m = markets[0]
    m["_outcomes"] = parse_list(m.get("outcomes"))
    m["_prices"] = [float(p) for p in parse_list(m.get("outcomePrices"))]
    m["_tokens"] = parse_list(m.get("clobTokenIds"))
    return m


def outcome_index(market, outcome):
    names = [o.lower() for o in market["_outcomes"]]
    if outcome.lower() not in names:
        sys.exit(f"Outcome '{outcome}' not in {market['_outcomes']}")
    return names.index(outcome.lower())


def get_book(token_id):
    book = get_json(f"{CLOB}/book?token_id={token_id}")
    asks = sorted(((float(l["price"]), float(l["size"])) for l in book["asks"]), key=lambda x: x[0])
    bids = sorted(((float(l["price"]), float(l["size"])) for l in book["bids"]), key=lambda x: -x[0])
    return asks, bids


def cmd_search(args):
    q = urllib.parse.quote(args.query)
    data = get_json(f"{GAMMA}/public-search?q={q}&limit_per_type={args.limit}&events_status=active")
    rows = []
    for event in data.get("events") or []:
        for m in event.get("markets") or []:
            if m.get("closed") or not m.get("active"):
                continue
            rows.append({
                "event": event.get("title"),
                "question": m.get("question"),
                "slug": m.get("slug"),
                "outcomes": dict(zip(parse_list(m.get("outcomes")), parse_list(m.get("outcomePrices")))),
                "end": m.get("endDate"),
                "volume": round(float(m.get("volumeNum") or m.get("volume") or 0)),
            })
    print(json.dumps(rows, indent=2))


def cmd_quote(args):
    m = get_market(args.slug)
    out = {"question": m["question"], "slug": m["slug"], "end": m.get("endDate"),
           "accepting_orders": m.get("acceptingOrders"), "closed": m.get("closed"), "outcomes": {}}
    for name, token in zip(m["_outcomes"], m["_tokens"]):
        asks, bids = get_book(token)
        out["outcomes"][name] = {
            "best_ask": asks[0][0] if asks else None,
            "ask_depth_usd_top5": round(sum(p * s for p, s in asks[:5]), 2),
            "best_bid": bids[0][0] if bids else None,
            "bid_depth_usd_top5": round(sum(p * s for p, s in bids[:5]), 2),
        }
    print(json.dumps(out, indent=2))


def spent_today(ledger):
    today = datetime.now(timezone.utc).date().isoformat()
    return sum(t["cost_usd"] for t in ledger["trades"]
               if t["side"] == "buy" and t["time"].startswith(today))


def cmd_place(args):
    cfg = load_config()
    ledger = load_ledger()
    m = get_market(args.slug)
    if m.get("closed") or not m.get("acceptingOrders"):
        sys.exit(f"Market '{args.slug}' is not accepting orders.")
    if not 0 < args.limit < 1:
        sys.exit("--limit must be between 0 and 1.")
    idx = outcome_index(m, args.outcome)
    outcome = m["_outcomes"][idx]
    asks, bids = get_book(m["_tokens"][idx])
    key = f"{m['slug']}::{outcome}"

    if args.side == "buy":
        if args.usd is None:
            sys.exit("Buys need --usd.")
        if args.usd > cfg["max_bet_usd"]:
            sys.exit(f"${args.usd} is over the per-bet cap of ${cfg['max_bet_usd']}.")
        if spent_today(ledger) + args.usd > cfg["daily_limit_usd"]:
            sys.exit(f"Would exceed the daily limit of ${cfg['daily_limit_usd']} "
                     f"(${spent_today(ledger):.2f} spent today).")
        if args.usd > ledger["cash"]:
            sys.exit(f"Not enough paper cash (${ledger['cash']:.2f}).")
        budget, shares, cost = args.usd, 0.0, 0.0
        for price, size in asks:
            if price > args.limit or budget <= 1e-9:
                break
            take = min(size, budget / price)
            shares += take
            cost += take * price
            budget -= take * price
    else:
        if args.shares is None:
            sys.exit("Sells need --shares.")
        held = ledger["positions"].get(key, {}).get("shares", 0.0)
        if args.shares > held + 1e-9:
            sys.exit(f"You only hold {held:.2f} shares of {key}.")
        remaining, shares, cost = args.shares, 0.0, 0.0
        for price, size in bids:
            if price < args.limit or remaining <= 1e-9:
                break
            take = min(size, remaining)
            shares += take
            cost += take * price
            remaining -= take

    if shares <= 1e-9:
        best = (asks[0][0] if asks else None) if args.side == "buy" else (bids[0][0] if bids else None)
        print(json.dumps({"status": "not_filled", "reason": f"no liquidity at limit {args.limit}",
                          "best_price_now": best}, indent=2))
        return

    leftover = budget if args.side == "buy" else remaining * args.limit
    status = "filled" if leftover <= 0.01 else "partially_filled"
    shares, cost = round(shares, 4), round(cost, 4)
    pos = ledger["positions"].setdefault(key, {"question": m["question"], "slug": m["slug"],
                                                "outcome": outcome, "shares": 0.0, "cost_basis": 0.0})
    if args.side == "buy":
        ledger["cash"] = round(ledger["cash"] - cost, 4)
        pos["shares"] = round(pos["shares"] + shares, 4)
        pos["cost_basis"] = round(pos["cost_basis"] + cost, 4)
    else:
        avg = pos["cost_basis"] / pos["shares"]
        ledger["cash"] = round(ledger["cash"] + cost, 4)
        pos["cost_basis"] = round(pos["cost_basis"] - avg * shares, 4)
        pos["shares"] = round(pos["shares"] - shares, 4)
        if pos["shares"] <= 1e-6:
            del ledger["positions"][key]

    trade = {"time": now_iso(), "slug": m["slug"], "question": m["question"], "outcome": outcome,
             "side": args.side, "limit": args.limit, "shares": shares, "cost_usd": cost,
             "avg_price": round(cost / shares, 4), "alert": args.alert}
    ledger["trades"].append(trade)
    save_ledger(ledger)
    print(json.dumps({"status": status, "trade": trade, "cash_left": ledger["cash"]}, indent=2))


def cmd_portfolio(args):
    ledger = load_ledger()
    cfg = load_config()
    rows, value = [], 0.0
    for key, pos in list(ledger["positions"].items()):
        m = get_market(pos["slug"])
        idx = outcome_index(m, pos["outcome"])
        if m.get("closed"):
            payout = round(pos["shares"] * m["_prices"][idx], 4)
            ledger["cash"] = round(ledger["cash"] + payout, 4)
            ledger["trades"].append({"time": now_iso(), "slug": pos["slug"], "question": pos["question"],
                                     "outcome": pos["outcome"], "side": "settle", "shares": pos["shares"],
                                     "cost_usd": payout, "alert": "market resolved"})
            del ledger["positions"][key]
            rows.append({**pos, "status": "settled", "payout": payout})
            continue
        _, bids = get_book(m["_tokens"][idx])
        mark = bids[0][0] if bids else m["_prices"][idx]
        mv = round(pos["shares"] * mark, 2)
        value += mv
        rows.append({**pos, "mark_bid": mark, "value": mv, "pnl": round(mv - pos["cost_basis"], 2)})
    save_ledger(ledger)
    total = round(ledger["cash"] + value, 2)
    print(json.dumps({"cash": round(ledger["cash"], 2), "positions": rows, "total_value": total,
                      "total_pnl": round(total - cfg["starting_balance_usd"], 2),
                      "spent_today": round(spent_today(ledger), 2)}, indent=2))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--limit", type=int, default=5)
    s.set_defaults(fn=cmd_search)
    q = sub.add_parser("quote")
    q.add_argument("slug")
    q.set_defaults(fn=cmd_quote)
    o = sub.add_parser("place")
    o.add_argument("--slug", required=True)
    o.add_argument("--outcome", required=True)
    o.add_argument("--side", choices=["buy", "sell"], required=True)
    o.add_argument("--usd", type=float)
    o.add_argument("--shares", type=float)
    o.add_argument("--limit", type=float, required=True)
    o.add_argument("--alert", required=True, help="the Discord message this trade came from")
    o.set_defaults(fn=cmd_place)
    f = sub.add_parser("portfolio")
    f.set_defaults(fn=cmd_portfolio)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
