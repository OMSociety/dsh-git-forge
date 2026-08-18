# 更新日志

[English](./CHANGELOG.md) | [简体中文](./CHANGELOG.zh-CN.md)

## 0.1.4 — 2026-08-18

### 修复
- agent shell 注入 **`DSH_GIT_FORGE_PROJECT`**（会话工作区），子仓 cwd 仍用工作区授权
- helper 在无 env 时 **向上匹配** `/workspace` 下 grants key
- push guard 对裸 **`git push` / `git push origin`** 同步解析 `remote get-url` 再裁决
- 文档与 `get_policy` 补充 project key 来源与 `list_accounts`

## 0.1.3 — 2026-08-18

### 新增
- **Agent HTTPS git 认证**：Host 侧 credential helper + `$DSH_HOME/git-forge/gitconfig`（`GIT_CONFIG_GLOBAL`），agent bash 中的 `git` 可透明使用侧栏已授权账号
- **R1 选号**：同一 host 仅当恰好 1 个已授权 token 账号时自动注入；token 永不进模型上下文
- health：`gitCredentialHelper` / `gitconfigPath` / `gitConfigGlobalActive`

## 0.1.2 — 2026-08-18

### 修复
- **GitForge 作为全局模型工具正确注册**（不再依赖 out-of-tree 解析 `@deepseek-ai/dsh-tools` 的 `defineTool`；改用与 modlens / dsh-ssh-tunnel 相同的裸 JSON Schema + 必填 `output`）。此前标准对话工具列表中看不到该工具。
- `health.version` 与 `package.json` 对齐；`health.gitForgeRegistered` 报告注册状态

## 0.1.1

### 社区发布形态
- 对齐 dsh-better-sidebar 的公开仓库结构  
- 增加 `scripts/install.sh` / `install.ps1`（默认 GitHub；`--from npm` 预留）  
- package.json：`repository` / `homepage` / `bugs` / `publishConfig`  

### 功能
- Gitea/GitLab：保存/探测时自动补全 API 路径（站点根 → `/api/v1` 或 `/api/v4`）  
- 探测增加 10s 超时，返回具体 URL 与失败原因  
- 账号行内显示探测成功/失败  

## 0.1.0

- 首版：better-sidebar「Git 凭据」Tab  
- 账号库（GitHub / Gitea / GitLab / Gitee / Bitbucket）  
- 按项目授权 + enforce push  
- Host `tools.guard` 拦截未授权 `git push` / `git remote add|set-url`  
- 模型工具 `GitForge`  
- UI 对齐 dsh-ssh-tunnel  
