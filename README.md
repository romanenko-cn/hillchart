# Hillchart

A Shape Up hill chart tool — web app and CLI.

The hill chart visualizes project progress by showing where each scope sits between
"figuring it out" (left/uphill) and "in execution" (right/downhill).

---

## Web App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to use the interactive editor.

---

## CLI

Manage hill charts from the terminal. Each command re-renders the chart as a PNG.
Open it in Preview once — it live-reloads on every update.

### Setup

```bash
npm install

# Optional: add an alias to ~/.zshrc
alias hill="npm run hill --prefix ~/dev/hillchart --"
```

### Usage

```bash
hill init [title]             # create hill.json in the current directory
hill add <name> [--pos 0-100] # add a scope (default position: 0)
hill move <name> <0-100>      # move a scope along the hill
hill done <name>              # mark a scope complete (removes it)
hill list                     # list all scopes with positions
hill show                     # render PNG and open in Preview
hill export [output.png]      # export PNG to a custom path
```

### Placement guide

| Range | Meaning |
|-------|---------|
| 0–35  | Still figuring out the problem or approach |
| 36–49 | Approaching clarity, important unknowns remain |
| 50    | Crest — path is clear |
| 51–69 | Implementation path known, meaningful execution remains |
| 70–84 | Largely in place, in review / QA / stabilization |
| 85–94 | QA exercised, remaining work is fixes / hardening |
| 95–100 | Effectively done |

### Example

```bash
cd my-project
hill init "Sprint 5"
hill add "Auth refactor" --pos 15
hill add "Ingestion pipeline" --pos 50
hill add "Analytics dashboard" --pos 75
hill show   # opens in Preview — leave it open
hill move "Auth refactor" 45   # Preview updates live
hill done "Analytics dashboard"
```

### Output

![CLI output](docs/cli-output.png)

---

## Development

```bash
npm test       # run unit tests
npm run build  # production build
```
