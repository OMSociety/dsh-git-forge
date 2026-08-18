# dsh-git-forge

[English](./README.md) | [简体中文](./README.zh-CN.md)

DeepSeek Harness community plugin: **forge accounts + per-project grants + push policy** in [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar).

- Account library: GitHub / Gitea / GitLab / Gitee / Bitbucket  
- **Project grants** (`projectPathKey` = workspace cwd)  
- **Push guard**: blocks bash `git push` / `git remote add|set-url` to non-granted hosts  
- Tokens in `$DSH_HOME/git-forge/secrets.json` (`0600`) — **never in model context**  
- Model tool **`GitForge`** (read-only policy)  
- UI aligned with [dsh-ssh-tunnel](https://github.com/thirsty5034/dsh-ssh-tunnel)

Does **not** replace system `gh auth` / SSH. The plugin decides *where a project may push*.

## Requirements

- DSH web profile with **dsh-better-sidebar** (≥ 0.12)  
- Node.js 18+

## Install

**macOS / Linux** (Git Bash / WSL on Windows also works):

```sh
curl -fsSL https://raw.githubusercontent.com/thirsty5034/dsh-git-forge/main/scripts/install.sh | bash
```

**Windows (PowerShell 5.1+ / pwsh)**:

```powershell
irm https://raw.githubusercontent.com/thirsty5034/dsh-git-forge/main/scripts/install.ps1 | iex
```

Or via DSH CLI directly (GitHub source until the package is on npm):

```bash
export DSH_HOME=${DSH_HOME:-$HOME/.dsh}
dsh plugin --profile web add "dsh-git-forge@github:thirsty5034/dsh-git-forge"
dsh --profile web --dump-config | grep git-forge
```

After install: **restart DSH web**, then hard-refresh the browser (`Cmd/Ctrl+Shift+R`).

<details>
<summary><b>Options / local link / npm (later)</b></summary>

```sh
# pin ref
curl -fsSL .../install.sh | bash -s main --restart
bash scripts/install.sh --from npm 0.1.1   # after npm publish

# local checkout
dsh plugin --profile web add "dsh-git-forge@link:/path/to/dsh-git-forge"
# or: ./scripts/sync-to-dsh.sh && dsh plugin add "dsh-git-forge@link:$DSH_HOME/local-plugins/dsh-git-forge"
```

</details>


## Discoverability

- GitHub topics: `dsh-plugin`, `deepseek-harness`, `dsh` (required for [dsh.so](https://www.dsh.so/) auto-index)
- Install from GitHub (current): see **Install** above
- Store listings may lag crawlers; source of truth is this repository


## Data

Under `$DSH_HOME/git-forge/`:

| File | Purpose |
|------|---------|
| `accounts.json` | Account metadata (no tokens) |
| `secrets.json` | Tokens (`0600`) |
| `grants.json` | `projectPathKey → accountIds[]` + enforce policy |

## Sidebar

1. **Project access** — accounts for the current project + enforce push  
2. **Accounts** — CRUD, API token probe  
3. **Policy** — allowed gitHosts; unbound-project default  

## Model tool

```text
GitForge action=get_policy
GitForge action=list_project_accounts
GitForge action=check_remote url=git@github.com:org/repo.git
```

## Security

- Tokens never appear in tool/API results or model context  
- Push policy is enforced in Host `tools.guard`  
- With **no** project grants, push is **not** blocked by default (progressive enablement)

## Development

```bash
npm test
npm run check
./scripts/sync-to-dsh.sh   # optional: copy into $DSH_HOME/local-plugins
```

## License

MIT — see [LICENSE](./LICENSE).
