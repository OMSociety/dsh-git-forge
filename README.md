<p align="center"><strong>简体中文</strong> | <a href="README_en.md">English</a></p>

<div align="center">
  <h1>DSH Git Forge</h1>
  <p>DeepSeek Harness 的 Git 凭据与推送权限管理器：哪个项目能用哪个账号、允许推到哪些 host，一处说清。</p>
  <p>账号库与 token 只落在宿主侧。<strong>按项目授权</strong>决定 agent 用哪个账号，<strong>push 拦截</strong>决定这个项目允许推到哪。</p>

  <p>
    <a href="https://github.com/OMSociety/dsh-git-forge/releases"><img src="https://img.shields.io/github/v/tag/OMSociety/dsh-git-forge?label=version&color=4f6ef7" alt="Version"></a>
    <a href="https://github.com/deepseek-ai/dsh"><img src="https://img.shields.io/badge/DSH-%3E%3D0.1.7--rc.2_%3C0.3.0--0-4f6ef7" alt="DSH"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/OMSociety/dsh-git-forge?color=4f6ef7" alt="License"></a>
    <a href="https://github.com/OMSociety/dsh-git-forge/stargazers"><img src="https://img.shields.io/github/stars/OMSociety/dsh-git-forge?color=4f6ef7" alt="Stars"></a>
    <a href="https://github.com/OMSociety/dsh-git-forge/issues"><img src="https://img.shields.io/github/issues/OMSociety/dsh-git-forge?color=4f6ef7" alt="Issues"></a>
  </p>

<a href="#这是什么">这是什么</a> • <a href="#核心特性">核心特性</a> • <a href="#快速开始">快速开始</a> • <a href="#侧栏">侧栏</a> • <a href="#模型工具">模型工具</a> • <a href="#数据放在哪">数据放在哪</a> • <a href="#安全">安全</a> • <a href="#开发">开发</a> • <a href="#许可证与作者">许可证与作者</a>
</div>

> **提示：**本仓库是 `dsh-git-forge` 的维护主线，在 [OMSociety 仓库](https://github.com/OMSociety/dsh-git-forge) 独立延续（2026-09-28 起脱离 fork 网络）。上游项目与代码作者是 [thirsty5034/dsh-git-forge](https://github.com/thirsty5034/dsh-git-forge)（MIT，见 [LICENSE](LICENSE)）。修复与问题反馈都在本仓库处理。

## 这是什么

**dsh-git-forge** 是 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 的社区插件，在右侧栏宿主 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 里给你一个 **Forge 账号库 + 按项目授权 + 推送策略** 的管理面。

它管两件事：

- **agent 用哪份凭据**：在侧栏给项目授权账号之后，agent shell 里的 HTTPS `git fetch` / `git push` 由本插件的 credential helper 自动取用对应 token，token 只在宿主侧读，**不进模型上下文**。
- **这个项目允许推到哪**：未授权 host 会被 push 拦截器在工具层直接拒绝；裸 `git push` 与 `git push origin` 会先解析 remote URL 再判定。

SSH 远程与系统 `gh auth` 不受影响，仍走本机 SSH / `gh`；本插件只补 **DSH agent shell 下的 HTTPS** 这一段。

## 核心特性

| 特性 | 说明 |
|---|---|
| **账号库** | 账号按 `gitHost` 归集，界面给出 `github.com` / `gitee.com` / `gitlab.com` / `bitbucket.org` 常用选项，自建 Forge 直接填自己的域名；侧栏内可增删改并探测 API token |
| **按项目授权** | 授权 key 是 **DSH 会话工作区**（`projectPathKey`，agent shell 里即 `DSH_GIT_FORGE_PROJECT`），**不是**子仓路径 |
| **push 拦截** | 命令里的 URL、裸 `git push`、`git remote add` / `set-url` 都在 Host `tools.guard` 里按授权判定 |
| **agent HTTPS git** | 同一 host 恰好 **1** 个已授权 token 账号时（R1）helper 才自动注入；多账号时不猜号，宁可不注入 |
| **token 落盘** | `$DSH_HOME/git-forge/secrets.json`（`0600`）；API 与工具结果一律不回传 token |
| **模型工具 GitForge** | 四个只读动作：看账号库、看某项目授权、看策略、校验某个 remote 是否被允许 |
| **UI 对齐** | 与同门的 [dsh-ssh-tunnel](https://github.com/OMSociety/dsh-ssh-tunnel) 共用一套侧栏交互 |

## 快速开始

**方式一：从 npm 安装（推荐）**

```powershell
# 1) 先停掉 dsh web（运行中的服务会锁住依赖，装完再起）
dsh plugin --profile web add "dsh-git-forge@1.0.0"
# 2) 重新启动 dsh web
```

包已发布到 npm，随包提供预构建产物，本地不需要构建步骤；换版本就把 `@1.0.0` 换成目标版本。

**方式二：从 GitHub 源安装**

```powershell
dsh plugin --profile web add "github:OMSociety/dsh-git-forge"
```

想复现某次安装就钉住 ref：在仓库地址后加 `#<tag 或提交 sha>`。

**方式三：一键脚本**

```sh
curl -fsSL https://raw.githubusercontent.com/OMSociety/dsh-git-forge/main/scripts/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/OMSociety/dsh-git-forge/main/scripts/install.ps1 | iex
```

脚本默认走 GitHub 源（`bash scripts/install.sh --from npm 1.0.0` 可切到 npm），除安装外还会把 profile 的 `minimumReleaseAgeExclude` 补上本插件、校验 `dsh.profile.bundles` 确实写入、清掉旧版手写在 profile `cordis.patch.yml` 里的挂载（先加 `--dry-run` 可只看计划不动手）。

> **提示：**装好后**刷新一下浏览器页面**，右侧栏才会出现「Git 凭据」入口——只重启宿主不够，客户端产物是页面加载时取的。

**装完怎么用**

1. 打开右侧栏「Git 凭据」→ **账号库** 加一个账号（token 只在侧栏里填，不进对话）
2. 点探测确认这个 token 有效
3. 切到 **项目授权** → 勾上该账号并保存，当前工作区就拿到了推送凭据
4. 让 agent 在项目里跑 HTTPS 的 `git fetch` / `git push`，凭据由 helper 自动注入，模型看不到 token
5. 反过来试一个未授权的 host：让 agent 推过去，应当被 push 拦截器直接拒绝

## 侧栏

侧栏只有一个 Tab，内部三页：

| 页面 | 作用 |
|---|---|
| **项目授权** | 当前项目可用的账号，以及是否 `enforcePush` |
| **账号库** | 账号增删改、探测 API token、查看绑定的 `gitHost` |
| **策略状态** | 当前允许的 `gitHost`，以及未绑定项目的默认策略 |

## 模型工具

| 动作 | 作用 | 参数 |
|---|---|---|
| `GitForge action=list_accounts` | 列出账号库（不含 token） | `project_path`（可省，默认当前会话工作区） |
| `GitForge action=list_project_accounts` | 列出某项目已授权的账号 | `project_path` |
| `GitForge action=get_policy` | 看该项目策略：授权账号、是否 `enforcePush`、未绑定项目默认 | `project_path` |
| `GitForge action=check_remote` | 校验某个 remote URL 是否被允许推送（不推送） | `url`（必填） |

### Agent HTTPS 与项目路径

- 授权 key = **DSH 会话工作区**（agent shell 里注入 `DSH_GIT_FORGE_PROJECT`），不是子仓路径
- helper 找项目：`env` → cwd 精确匹配 → `/workspace` 下向父目录 walk
- R1：同一 host 仅当恰好 **1** 个已授权 **token** 账号时才自动注入凭据
- agent shell 的 `GIT_CONFIG_GLOBAL` 指向 `$DSH_HOME/git-forge/gitconfig`；文件里先放一条空 `credential.helper` 清掉系统级 helper，再挂本插件 helper，因此系统凭据管理器的弹窗不会卡住无头 shell

## 数据放在哪

`$DSH_HOME/git-forge/`（目录 `0700`）：

| 文件 | 内容 |
|---|---|
| `accounts.json` | 账号元数据（不含 token） |
| `secrets.json` | token（`0600`） |
| `grants.json` | `projectPathKey → accountIds[]` 与 enforce / unbound 策略 |
| `gitconfig` | 注入给 agent shell 的 credential helper 配置（不含凭据） |

## 安全

- token 不出现在 API 结果、工具结果与模型上下文里
- push 策略在 Host `tools.guard` 中硬拦截，不依赖模型自觉
- 未给项目配置任何授权时，push 拦截器默认**不**拦截（便于渐进启用），helper 也不会凭空给出凭据
- helper 只在宿主进程内读 `secrets.json`；`secrets.json` 疑似泄露请立即轮换 token

## 环境要求

- DSH web profile，DSH 版本 `>=0.1.7-rc.2 <0.3.0-0`
- 右侧栏宿主 **dsh-better-sidebar** `>=0.12.0`
- Node.js `>= 20`

> **提示：**升级到 DSH 0.2.x 之前，先确认右侧栏宿主已发布覆盖 0.2 的版本。

## 开发

```powershell
npm test                   # node --test：自检脚本全量回归
npm run check              # 语法 + 自检
bash scripts/sync-to-dsh.sh   # 以 link: 方式把本仓库接入 web profile（开发用）
bash scripts/install.sh --dry-run   # 只看安装计划，不动 profile
```

目录与「改东西去哪」：

```text
lib/index.js            宿主入口：工具注册、/dsh-git-forge/api 路由、push 拦截、credential helper 配置
lib/client.js           客户端 bundle（已入库；dsh plugin add 不做构建）
lib/shared/             宿主与客户端共用纯函数：path / git-policy / remote-resolve / credential-select / account-summary
scripts/                install.sh · install.ps1 · sync-to-dsh.sh · smoke-test.mjs · git-credential helper
cordis.patch.yml        包内 bundle patch，CLI 据此写入 dsh.profile.bundles
```

## 支持与致谢

- 如果这个插件对你有帮助，欢迎点亮 Star；有问题或建议请提 [Issue](https://github.com/OMSociety/dsh-git-forge/issues) 或 [Pull Request](https://github.com/OMSociety/dsh-git-forge/pulls)。
- 变更记录见 [CHANGELOG](CHANGELOG.md)。
- [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)：右侧栏宿主与 Tab 契约
- [dsh-ssh-tunnel](https://github.com/OMSociety/dsh-ssh-tunnel)：同门插件，主机库与侧栏交互与本案对齐
- [DeepSeek Harness](https://github.com/deepseek-ai/dsh)：插件、工具与 agent shell 的宿主

## 许可证与作者

[MIT](LICENSE)。上游项目与代码作者 [@thirsty5034](https://github.com/thirsty5034)；本仓库的维护与新增部分 © 2026 [@OMSociety](https://github.com/OMSociety)。
