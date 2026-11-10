# AGENTS.md

You are my pair programmer for a school final project: a **Crypto Portfolio Tracker** web app.

# Name

The app is called Stackwatch (tagline: "Watch the market. Track your stack."). Use this name in the navbar, page titles (<title>), README and repo. The repo name is stackwatch, so in vite.config.js the base path is /stackwatch/.

## Project

- React (Vite), React Router (use `HashRouter` so GitHub Pages works), React Bootstrap + Bootstrap for style
- Functionality libraries: Recharts (charts), date-fns (date formatting), react-hot-toast (notifications)
- API: CoinGecko (https://api.coingecko.com/api/v3), a real REST API that returns JSON. Use `fetch` and `async/await` only.
- Endpoints to use:
  - Market list: `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false`
  - Coin detail: `/coins/{id}`
  - Price history: `/coins/{id}/market_chart?vs_currency=usd&days=30`
- Check the current CoinGecko docs before coding, because the free tier's limits and key requirements can change.
- Three screens, each with its own purpose:
  1. **Market dashboard** (`/`): table of top coins with price, 24h change, market cap, auto-refresh, and a search/filter box
  2. **Coin detail** (`/coin/:id`): price history chart with a range selector (7, 30, 90 days), key stats, and an "Add to portfolio" button
  3. **Portfolio simulator** (`/portfolio`): holdings I add (coin, amount, buy price), with current value, profit/loss per holding, total P/L, and a pie chart of allocation. Stored in localStorage.
- Must be deployable to GitHub Pages, with a README that explains how to install and run.
- No weather features. Do not add anything that is not in the feature list below.

## Rules for the code

- Keep components small and in separate files (`pages/`, `components/`, `api.js`, `context/`).
- Free API limits are strict. Add simple caching (an in-memory object with timestamps) in the API helper so the same request is not repeated within 60 seconds. Show a friendly message when the API returns a 429.
- Every data fetch needs three states: loading (spinner), error (message with a retry button), and empty.
- Clean up intervals and cancel stale requests in `useEffect` return functions.
- If an API key is needed, use a free **Demo** key in a `.env` file as `VITE_COINGECKO_KEY`. Add `.env` to `.gitignore` and commit a `.env.example` without the real value. Remember that anything in a Vite frontend is visible in the browser, so never use a paid key.
- Format numbers and dates properly (thousands separators, currency, date-fns for dates).

## How we work (important)

- Build **ONE feature at a time**, in the order below.
- Keep each feature small. Only touch the files that feature needs.
- After each feature:
  1. Briefly tell me which files you changed and how to test it in the browser.
  2. Give me a git commit message in Conventional Commits style (for example `feat: add market dashboard table`).
  3. Give me the exact commands: `git add . && git commit -m "..." && git push`
  4. **STOP** and wait until I reply "next". Do not start the following feature on your own.
- If something fails, fix it before suggesting a commit.
- Do not change my git remote or git config. The remote is already set up for the correct GitHub account.
- Explain new concepts in one or two sentences so I can describe them in my project review.

## Feature order

1. Project setup: install dependencies, clean the Vite boilerplate, add the Bootstrap CSS import, add `.gitignore` check
2. Routing and navbar: `HashRouter`, three placeholder pages, a 404 page
3. API helper file: functions for markets, coin detail and market chart, with the 60-second cache and error handling
4. Market dashboard: fetch and show the top coins in a table
5. Loading spinner, error message with retry, and empty state on the dashboard
6. Dashboard formatting: currency and percentage formatting, green and red 24h change, responsive table
7. Search and filter on the dashboard, plus sorting by price or market cap
8. Auto-refresh every 60 seconds with a "last updated" time (date-fns) and cleanup
9. Coin detail page: fetch by id with `useParams`, show image, name, price and key stats
10. Price history chart (Recharts line chart) with a 7/30/90 day range selector
11. Portfolio context: add and remove holdings, saved in localStorage
12. "Add to portfolio" form on the detail page, with a toast on success
13. Portfolio page: table of holdings with current value and profit/loss per holding, using live prices
14. Portfolio totals and a pie chart of allocation
15. Responsive and visual polish (custom colors, fonts, dark theme)
16. README (install, run, features, libraries used, live URL)
17. Deploy to GitHub Pages (base path in `vite.config.js`, `gh-pages` package, deploy script)

Start with feature 1 only.