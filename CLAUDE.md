# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

`C:\Users\peter` is Peter's Windows home directory, not a single codebase. There is no top-level build, lint, or test command — each project under `Projects\` is its own repository with its own tooling; `cd` into the specific project before running anything.

Environment-wide rules (Hermes agent setup, credentials location, known issues, how to communicate with Peter) live in `C:\Users\peter\.claude\CLAUDE.md` and are loaded automatically. Follow that file; this one only maps the directory.

## Directory map

- `Projects\` — active work. ~30 independent projects, mostly Hermes-related (hermes-agent, hermes-mcp-wire, hermeshub, super-hermes, mission-control, etc.) plus unrelated ones (card-restoration, codegraph, autonovel, …).
- `Desktop\claude.md\` — a **folder** (not a file) of reference notes, logs, and credentials. See the global CLAUDE.md before touching anything here.
- `Scripts\` — accumulated one-off utility scripts (PowerShell, Python, batch). Not a project; no shared tooling. `.secrets.ps1` and `.kimi-api-key.ps1` contain secrets — never print their contents.
- `Loose\` — archived dot-folders and configs swept out of the home root (from other AI tools: aider, augment, bun, cargo, etc.).
- Loose files in the home root (`docker-wsl.sh`, `htg.py`, `infsh-install.sh`, `syn.yaml`, …) are one-off setup leftovers, not a project.

## The three hermes-agent copies

There are three `hermes-agent` directories; picking the wrong one is the most likely mistake in this environment:

1. `C:\Users\peter\AppData\Local\hermes\hermes-agent` — the **installed, running desktop app**. Its live config/logs are one level up in `AppData\Local\hermes\` (details in the global CLAUDE.md). Don't develop here.
2. `C:\Users\peter\Projects\hermes-agent` — the **current source clone** of github.com/NousResearch/hermes-agent (has `.venv`, `.claude\`, the Photon iMessage sidecar plugin). **Use this one for source work.**
3. `C:\Users\peter\hermes-agent` — a **stale clone** of the same repo (last commit June 2026, about a month behind the Projects copy). Prefer the Projects copy; treat this one as disposable unless Peter says otherwise.

## Pitfalls

- `Projects\%userprofile%` and `Projects\C␀` (a folder whose name is a stray `C` artifact) were created by misquoted shell commands. They are junk, not projects — don't index them, and don't create paths like these (quote Windows paths with spaces/variables properly).
- Sessions often start in `C:\WINDOWS\system32` — never create files there; work in the relevant project directory.
