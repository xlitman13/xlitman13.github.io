# Family Yahtzee Scorecard

A phone-first Yahtzee scorecard that:
- supports up to 8 players
- automatically calculates upper subtotal, 35-point bonus, lower total, and grand total
- supports Yahtzee bonus scoring
- saves the game locally in the browser
- works offline after the first load when hosted over HTTPS
- can be added to a phone's home screen

## Run locally

Because the service worker needs HTTP/HTTPS, use a tiny local server instead of double-clicking the HTML file.

### Python
```bash
python -m http.server 8000
```

Then open:
http://localhost:8000

## Deploy free

You can upload these files to:
- GitHub Pages
- Netlify
- Cloudflare Pages
- Vercel

No server-side code or database is required.

## Notes

This app is intentionally designed as a shared/local scorecard. Each phone stores its own game state. A later version could add shared live rooms so multiple phones stay synchronized.
