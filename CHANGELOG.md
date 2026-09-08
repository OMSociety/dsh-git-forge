# Changelog

[English](./CHANGELOG.md) | [简体中文](./CHANGELOG.zh-CN.md)

## 0.1.5 — 2026-09-08

### Fixed
- Remove **`@deepseek-ai/dsh-client-runtime`** from `dsh.client.inject`. The package was deleted in DSH 0.1.2 (community upgrade card `DSH-0.1.2-A1-25`); keeping the phantom in `inject` left the client assembly row pending / out of the boot graph on 0.1.2 hosts. `@deepseek-ai/dsh-client-locale` is retained (provides `ctx.locale`). First tagged release — also covers the 0.1.4-era features (R1 Host credential helper, GitForge model-tool registration, monorepo project key).

## 0.1.4 — 2026-08-18

### Fixed
- Inject **`DSH_GIT_FORGE_PROJECT`** (session workspace) into agent shells so monorepo subfolder `git` cwd still uses workspace grants
- Credential helper **walks parent dirs** under `/workspace` when env is unset
- Push guard resolves **bare `git push` / `git push origin`** via `git remote get-url` before policy check
- Docs + `get_policy` describe project key sources and `list_accounts`

## 0.1.3 — 2026-08-18

### Added
- **Agent HTTPS git auth** via Host-only git credential helper (`scripts/git-credential-dsh-git-forge.mjs`) and `$DSH_HOME/git-forge/gitconfig` (`GIT_CONFIG_GLOBAL` for agent shells)
- **R1 account selection:** exactly one authorized token account per remote host; tokens never enter model context
- Health: `gitCredentialHelper`, `gitconfigPath`, `gitConfigGlobalActive`

## 0.1.2 — 2026-08-18

### Fixed
- **GitForge registers as a global model tool** without importing `@deepseek-ai/dsh-tools` (raw JSON-Schema definition + required `output`, same pattern as modlens / dsh-ssh-tunnel). Out-of-tree `defineTool` resolution left the tool missing from standard chat catalogs.
- `health.version` tracks `package.json`; `health.gitForgeRegistered` reports registration status

## 0.1.1

### Community packaging
- Public GitHub repo layout aligned with dsh-better-sidebar  
- `scripts/install.sh` / `install.ps1` (GitHub default; `--from npm` ready)  
- package.json: `repository` / `homepage` / `bugs` / `publishConfig`  

### Features
- Auto-normalize Gitea/GitLab API bases (site root → `/api/v1` or `/api/v4`)  
- Probe timeout (10s) with explicit URL/error text  
- Inline per-account probe result in the sidebar  

## 0.1.0

- Initial release: better-sidebar **Git Forge** tab  
- Account library (GitHub / Gitea / GitLab / Gitee / Bitbucket)  
- Per-project grants + enforce push  
- Host `tools.guard` for unauthorized `git push` / `git remote add|set-url`  
- Model tool `GitForge`  
- UI aligned with dsh-ssh-tunnel  

