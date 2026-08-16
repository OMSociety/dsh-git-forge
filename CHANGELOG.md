# Changelog

[English](./CHANGELOG.md) | [简体中文](./CHANGELOG.zh-CN.md)

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

