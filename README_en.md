<p align="center"><a href="README.md">简体中文</a> | <strong>English</strong></p>

<div align="center">
  <h1>DSH Git Forge</h1>
  <p>Git credentials and push policy for DeepSeek Harness: which project may use which account, and where it is allowed to push.</p>
  <p>Accounts and tokens stay host-side. <strong>Per-project grants</strong> decide which account an agent uses; the <strong>push guard</strong> decides where that project may push.</p>

  <p>
    <a href="https://github.com/OMSociety/dsh-git-forge/releases"><img src="https://img.shields.io/github/v/tag/OMSociety/dsh-git-forge?label=version&color=4f6ef7" alt="Version"></a>
    <a href="https://github.com/deepseek-ai/dsh"><img src="https://img.shields.io/badge/DSH-%3E%3D0.1.7--rc.2_%3C0.3.0--0-4f6ef7" alt="DSH"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/OMSociety/dsh-git-forge?color=4f6ef7" alt="License"></a>
    <a href="https://github.com/OMSociety/dsh-git-forge/stargazers"><img src="https://img.shields.io/github/stars/OMSociety/dsh-git-forge?color=4f6ef7" alt="Stars"></a>
    <a href="https://github.com/OMSociety/dsh-git-forge/issues"><img src="https://img.shields.io/github/issues/OMSociety/dsh-git-forge?color=4f6ef7" alt="Issues"></a>
  </p>
</div>

> **Note:** This is the maintained line of `dsh-git-forge`, continued independently at the [OMSociety repository](https://github.com/OMSociety/dsh-git-forge) (standalone since 2026-09-28). The upstream project and the author of this code is [thirsty5034/dsh-git-forge](https://github.com/thirsty5034/dsh-git-forge) (MIT, see [LICENSE](LICENSE)). Fixes and issue reports are handled in this repository.

## What this is

**dsh-git-forge** is a community plugin for [DeepSeek Harness](https://github.com/deepseek-ai/dsh). Inside the sidebar host [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) it gives you one place to manage a **forge account library, per-project grants and push policy**.

It governs two things:

- **Which credential an agent uses.** Once a project is granted an account, HTTPS `git fetch` / `git push` in agent shells pick up that account's token through this plugin's credential helper. Tokens are read host-side only and **never enter model context**.
- **Where the project may push.** Non-granted hosts are rejected at the tool layer by the push guard; bare `git push` and `git push origin` are resolved to their remote URL before the decision.

SSH remotes and the system `gh auth` are untouched and keep using your local SSH / `gh`. This plugin only covers **HTTPS in DSH agent shells**.

## Features

| Feature | Description |
|---|---|
| **Account library** | Accounts are keyed by `gitHost`; the UI suggests `github.com` / `gitee.com` / `gitlab.com` / `bitbucket.org`, and self-hosted forges take their own domain. Create, edit, delete and probe an API token from the sidebar |
| **Per-project grants** | The grant key is the **DSH session workspace** (`projectPathKey`, exposed to agent shells as `DSH_GIT_FORGE_PROJECT`), **not** a nested package path |
| **Push guard** | URLs in the command, bare `git push`, and `git remote add` / `set-url` are all decided in the host's `tools.guard` |
| **Agent HTTPS git** | Credentials are auto-filled only when exactly **one** token account is granted for that host (R1); with several, it declines to guess |
| **Token storage** | `$DSH_HOME/git-forge/secrets.json` (`0600`); no token is ever returned by an API or tool result |
| **`GitForge` tool** | Four read-only actions: list accounts, list a project's granted accounts, read the policy, check whether a remote is allowed |
| **UI parity** | Shares one sidebar interaction model with its sibling [dsh-ssh-tunnel](https://github.com/OMSociety/dsh-ssh-tunnel) |

## Quick start

**Option 1: install from npm (recommended)**

```powershell
# 1) stop dsh web first (a running server holds the dependency lock; start it again afterwards)
dsh plugin --profile web add "dsh-git-forge@1.0.0"
# 2) restart dsh web
```

The package is published to npm and ships the prebuilt artifacts, so no local build step is involved. Replace `@1.0.0` to install another version.

**Option 2: install from the GitHub source**

```powershell
dsh plugin --profile web add "github:OMSociety/dsh-git-forge"
```

To reproduce a specific install, pin a ref by appending `#<tag or commit sha>` to the repository URL.

**Option 3: one-line installer**

```sh
curl -fsSL https://raw.githubusercontent.com/OMSociety/dsh-git-forge/main/scripts/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/OMSociety/dsh-git-forge/main/scripts/install.ps1 | iex
```

The script installs from the GitHub source by default (`bash scripts/install.sh --from npm 1.0.0` switches to npm). Besides installing, it adds this plugin to the profile's `minimumReleaseAgeExclude`, verifies that `dsh.profile.bundles` really received the entry, and removes the mount older versions wrote by hand into the profile's `cordis.patch.yml`. Add `--dry-run` to print the plan without touching anything.

> **Note:** After installing, **refresh the browser page** for the "Git Forge" entry to appear in the sidebar — restarting the host alone is not enough, because the client artifact is fetched when the page loads.

**First run**

1. Open the "Git Forge" tab in the sidebar and add an account on the **Accounts** page (the token is entered in the sidebar, not in chat)
2. Use the probe to confirm the token works
3. Switch to **Project access**, tick that account and save — the current workspace now has push credentials
4. Have the agent run HTTPS `git fetch` / `git push` in the project; the helper fills in the credential and the model never sees the token
5. Try the opposite: point the agent at a non-granted host and the push guard should reject it outright

## Sidebar

One sidebar tab with three pages:

| Page | Purpose |
|---|---|
| **Project access** | Accounts available to the current project, and whether `enforcePush` is on |
| **Accounts** | Create, edit, delete accounts, probe an API token, inspect the bound `gitHost` |
| **Policy** | Allowed `gitHost` values and the default for unbound projects |

## Model tool

| Action | Purpose | Arguments |
|---|---|---|
| `GitForge action=list_accounts` | List the account library (no tokens) | `project_path` (optional, defaults to the session workspace) |
| `GitForge action=list_project_accounts` | List the accounts granted to a project | `project_path` |
| `GitForge action=get_policy` | Read that project's policy: granted accounts, `enforcePush`, unbound default | `project_path` |
| `GitForge action=check_remote` | Check whether a remote URL is allowed to push (does not push) | `url` (required) |

### Agent HTTPS and project paths

- Grant key = the **DSH session workspace** (injected into agent shells as `DSH_GIT_FORGE_PROJECT`), not a nested path
- Helper resolves the project as: `env` → exact cwd → walk parents under `/workspace`
- R1: credentials are auto-filled only when exactly **one** token account is granted for that host
- An agent shell's `GIT_CONFIG_GLOBAL` points at `$DSH_HOME/git-forge/gitconfig`; the file first carries an empty `credential.helper` that clears the system-level helper, then this plugin's helper — so a system credential manager cannot pop a dialog and hang a headless shell

## Where data lives

Under `$DSH_HOME/git-forge/` (directory mode `0700`):

| File | Contents |
|---|---|
| `accounts.json` | Account metadata (no tokens) |
| `secrets.json` | Tokens (`0600`) |
| `grants.json` | `projectPathKey → accountIds[]` plus enforce / unbound policy |
| `gitconfig` | Credential helper config injected into agent shells (holds no credentials) |

## Security

- Tokens never appear in API results, tool results or model context
- Push policy is enforced in the host's `tools.guard`, not left to the model
- With no grants configured for a project, the push guard does **not** block by default (progressive enablement), and the helper supplies no credentials either
- The helper reads `secrets.json` inside the host process only; rotate tokens immediately if `secrets.json` may have leaked

## Requirements

- A DSH web profile with DSH `>=0.1.7-rc.2 <0.3.0-0`
- Sidebar host **dsh-better-sidebar** `>=0.12.0`
- Node.js `>= 20`

> **Note:** Before upgrading to DSH 0.2.x, confirm the sidebar host has published a version covering 0.2.

## Development

```powershell
npm test                   # node --test: full regression of the smoke scripts
npm run check              # syntax + smoke tests
bash scripts/sync-to-dsh.sh   # register this checkout into the web profile as link: (dev)
bash scripts/install.sh --dry-run   # print the install plan without touching the profile
```

Layout and where to change what:

```text
lib/index.js            Host entry: tool registration, /dsh-git-forge/api routes, push guard, credential helper config
lib/client.js           Client bundle (committed; dsh plugin add does not build)
lib/shared/             Pure functions shared by host and client: path / git-policy / remote-resolve / credential-select / account-summary
scripts/                install.sh · install.ps1 · sync-to-dsh.sh · smoke-test.mjs · git-credential helper
cordis.patch.yml        In-package bundle patch the CLI turns into dsh.profile.bundles
```

## Support and credits

- If this plugin helps you, a Star is welcome; questions and suggestions go to [Issues](https://github.com/OMSociety/dsh-git-forge/issues) or [Pull Requests](https://github.com/OMSociety/dsh-git-forge/pulls).
- Changes are recorded in the [CHANGELOG](CHANGELOG.md).
- [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar): the sidebar host and tab contract
- [dsh-ssh-tunnel](https://github.com/OMSociety/dsh-ssh-tunnel): sibling plugin sharing the same sidebar interaction model
- [DeepSeek Harness](https://github.com/deepseek-ai/dsh): the host for plugins, tools and agent shells

## License and author

[MIT](LICENSE). Upstream project and code author [@thirsty5034](https://github.com/thirsty5034); maintenance and additions in this repository © 2026 [@OMSociety](https://github.com/OMSociety).
