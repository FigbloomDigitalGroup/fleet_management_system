**Every AI agent working in this repo MUST run this check before either of the following, every time, no exceptions:**

1. Running any build/dev/lint tooling (`npm run dev`, `npm run build`, `npm run lint`, `vite`, `next dev`, etc.)
2. Creating a git commit

**How to check** — scan every auto-loaded JS/TS config file in the working tree (`tailwind.config.*`, `postcss.config.*`, `eslint.config.*`, `vite.config.*`, `next.config.*`, and anything else Node loads automatically at build/dev time) for:

- The obfuscation signature: `grep -c '_0x' <file>` — any non-zero result is a red flag.
- Known indicator strings: `app-vscode-eval`, `verify-human`.
- Abnormal file size — these files are normally well under 5KB; tens of KB warrants inspection even with no `_0x` match.
- An unexplained change to `.gitignore` that removes or weakens the `.env`/`.env.*` exclusion.

**If anything matches:** stop immediately. Do not run the build/dev/lint command. Do not silently clean or overwrite the file — a naive full-file revert can destroy real legitimate config content mixed in with the payload. Tell the user exactly what you found (file, match, size) and wait for direction.









