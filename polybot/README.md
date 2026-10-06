# polybot: Discord alerts → Polymarket paper trades

```
Discord #bets ──► n8n (polls channel) ──► Claude Routine (HTTP) ──► Claude session
                                                                     reads alert (PLAYBOOK.md)
                                                                     finds market + live price
                                                                     paper.py place ──► approval prompt on your phone
                                                                     commits ledger.json
```

- `paper.py`: search, quote, place (simulated fill against the live order book) and portfolio. Public APIs only, no keys.
- `config.json`: paper balance, per-bet cap, daily cap, unit size.
- `ledger.json`: paper cash, positions and trade history (created on first trade).
- `PLAYBOOK.md`: what Claude does with each alert.
- `../.claude/settings.json`: forces an approval prompt on every `paper.py place`.

Check results any time: `python3 polybot/paper.py portfolio`.
