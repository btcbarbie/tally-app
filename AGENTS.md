<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## Project Agent Rules

### Response Format
- **Always end every response** with the current local dev URL: `http://localhost:3000`
- Also include the GitHub repo link: `https://github.com/btcbarbie/tally-app`

### Git Workflow
- After every code change, **commit and push to GitHub** automatically
- Use conventional commit messages: `feat:`, `fix:`, `chore:`, `refactor:`, `style:`
- Commit message should clearly describe what changed
- Always push to `origin main` after committing

### Role Model
- Creator of a goal = **Admin** (stored as `tally_admin_{goalId}` in localStorage)
- Anyone who joins = **Member** (stored as `tally_member_{goalId}` in localStorage)
- Admin sees: Delete Goal button, full dashboard
- Member sees: Leave Group button, member view only
