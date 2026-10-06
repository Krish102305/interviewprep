# Handling a Discord bet alert

You've been woken by n8n with a Discord message from the bets channel. Your job
is to turn it into a paper trade, but only after the user approves.

1. **Read the alert with judgment.** Work out: which market, which outcome,
   buy or sell, size, and price. Alerts are informal, so infer sensibly
   (e.g. "Yes on Xi/Takaichi by Dec @ 75c, 2u" = buy Yes at limit 0.75).
   - Units: 1u = $10 unless config.json says otherwise.
   - No price given: limit = current best ask + 0.02 for a buy (best bid - 0.02 for a sell).
   - No size given: $10.
   - Not a bet (chat, commentary, results recap): reply "not a bet" and stop.
2. **Find the market.** `python3 polybot/paper.py search "<keywords>"`. If more
   than one market plausibly matches and you can't tell which, don't guess:
   say so and stop.
3. **Check the price.** `python3 polybot/paper.py quote <slug>`. If the alert's
   price is more than 5c worse than the current price, say so in your summary.
4. **Place it.** Run `python3 polybot/paper.py place --slug ... --outcome ...
   --side buy --usd ... --limit ... --alert "<original message>"`. This command
   always triggers an approval prompt for the user; never try to avoid it.
   Before running it, write a one-line summary so the prompt makes sense:
   `PAPER BUY Yes "Will Xi meet with Takaichi by Dec 31?" $20 @ ≤0.77 (now 0.76, alert said 0.75)`
5. **Save the ledger.** After a fill, commit `polybot/ledger.json` and push to
   branch `claude/focused-dijkstra-0r8i2o` (git pull first so you don't clobber
   another session's trade).
6. **Report** what filled, the average price and remaining paper cash in one
   or two lines.

Never edit config.json limits or the ledger by hand.
