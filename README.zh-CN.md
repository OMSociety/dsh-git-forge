# dsh-git-forge

[English](./README.md) | [简体中文](./README.zh-CN.md)

DeepSeek Harness **社区插件**：在 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 中提供 **Forge 账号库 + 按项目授权 + push 策略**。

- 账号库：GitHub / Gitea / GitLab / Gitee / Bitbucket  
- **按项目授权**（`projectPathKey` = 工作区 cwd）  
- **push 拦截**：已授权项目下，bash 的 `git push` / `git remote add|set-url` 指向未授权 host 会被拒绝  
- Token 存 `$DSH_HOME/git-forge/secrets.json`（`0600`），**不进模型上下文**  
- 模型工具 **`GitForge`**（只读策略）  
- UI 对齐 [dsh-ssh-tunnel](https://github.com/thirsty5034/dsh-ssh-tunnel)

> 本插件**不替代**系统 `gh auth` / SSH；真实 git 认证仍走本机凭据。插件负责「这个项目允许推到哪」。

## 环境要求

- 已安装 **dsh-better-sidebar**（≥ 0.12）的 web profile  
- Node.js 18+

## 安装

**macOS / Linux**（Windows 可用 Git Bash / WSL）：

```sh
curl -fsSL https://raw.githubusercontent.com/thirsty5034/dsh-git-forge/main/scripts/install.sh | bash
```

**Windows（PowerShell 5.1+ / pwsh）**：

```powershell
irm https://raw.githubusercontent.com/thirsty5034/dsh-git-forge/main/scripts/install.ps1 | iex
```

或直接用 DSH CLI（在发布到 npm 之前默认走 GitHub 源）：

```bash
export DSH_HOME=${DSH_HOME:-$HOME/.dsh}
dsh plugin --profile web add "dsh-git-forge@github:thirsty5034/dsh-git-forge"
dsh --profile web --dump-config | grep git-forge
```

装完后：**重启 dsh web**，浏览器 **硬刷新**（`Cmd/Ctrl+Shift+R`）。

<details>
<summary><b>可选参数 / 本地 link / 日后 npm</b></summary>

```sh
curl -fsSL .../install.sh | bash -s main --restart
bash scripts/install.sh --from npm 0.1.1

dsh plugin --profile web add "dsh-git-forge@link:/path/to/dsh-git-forge"
```

</details>


## 可发现性

- GitHub topics：`dsh-plugin`、`deepseek-harness`、`dsh`（[dsh.so](https://www.dsh.so/) 自动收录所需）
- 当前请从 GitHub 安装：见上文 **安装**
- 商店目录可能滞后于爬虫；以本仓库为准


## 数据目录

`$DSH_HOME/git-forge/`（建议 `0700`）：

| 文件 | 用途 |
|------|------|
| `accounts.json` | 账号元数据（无 token） |
| `secrets.json` | token（`0600`） |
| `grants.json` | `projectPathKey → accountIds[]` + enforce / unbound 策略 |

## 侧栏

1. **项目授权** — 当前项目可用账号 + 是否 enforce push  
2. **账号库** — 增删改、探测 API token  
3. **策略状态** — 当前允许的 gitHost；全局「未绑定项目」策略  

## 模型工具

```text
GitForge action=get_policy
GitForge action=list_project_accounts
GitForge action=check_remote url=git@github.com:org/repo.git
```

## 安全

- API / 工具结果不得包含 token  
- push 策略在 Host `tools.guard` 中硬拦截  
- 未给项目配置任何授权时，默认 **不拦截**（便于渐进启用）

## 开发

```bash
npm test
npm run check
./scripts/sync-to-dsh.sh
```

## 许可证

MIT — 见 [LICENSE](./LICENSE)。
