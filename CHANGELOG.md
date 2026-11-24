# Changelog

本项目的更改记录在此文件。

All notable changes to this project are documented in this file.

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-25

### 变更

- HTTPS 凭据只按 DSH 会话工作区的授权选择。工作区未绑定时，侧栏不能保存项目授权，凭据助手也不提供 token；同一 Git 主机有多个已授权 token 账号时，仍需选定一个。
- Bash 和 PowerShell 中直接执行的 `git push`、`git remote add`、`git remote set-url` 按已保存的 Git 主机授权预检。裸推送按 Git 配置选择远程，并核对该远程的所有推送地址。预检只针对这些命令；进程隔离和网络出口限制由操作系统负责。

### 安全

- 只有通过宿主认证的所有者可以管理账号和授权。在 DSH `0.2.2-rc.5` 上必须是浏览器所有者连接；在 `0.2.3-alpha.2` 上，请求连接必须具有 `owner` 身份。身份无法确认时，先拒绝请求，不读取正文。
- 账号切换为 SSH 时清除已存 token，SSH 认证由系统处理。API 探测只有收到对应服务的账号身份字段才报告成功；API 地址不作为推送授权主机。

### 修复

- 账号或授权数据无法读取，或损坏的文件无法归档时，中止保存，防止默认值覆盖原数据。
- Agent shell 优先使用显式指定的 `GIT_CONFIG_GLOBAL`；未指定时按 Git 的顺序读取 XDG 配置和 `~/.gitconfig`，保留用户设置的优先级。

### 移除

- 移除独立安装脚本、profile 修复助手和源码同步脚本。安装插件使用 DSH 插件管理器。

### Changed

- HTTPS credentials are selected only from grants for the DSH session workspace. With no bound workspace, the sidebar cannot save project grants and the credential helper supplies no token. If several token accounts are granted for the same Git host, select just one.
- Direct `git push`, `git remote add` and `git remote set-url` commands in Bash and PowerShell are checked against saved Git-host grants. For a bare push, the check uses Git configuration to select the remote and checks all its push URLs. This check covers only those commands; process isolation and network egress controls are the operating system’s responsibility.

### Security

- Only a host-authenticated owner can manage accounts and grants. DSH `0.2.2-rc.5` requires the browser owner connection; `0.2.3-alpha.2` requires the request connection to have an `owner` identity. Requests without proof of ownership are rejected before the body is read.
- Switching an account to SSH clears its stored token and leaves SSH authentication to the system. An API probe reports success only if the provider returns an account identity field. The API endpoint does not count as an authorized push host.

### Fixed

- Saving stops if account or grant data cannot be read or a corrupt file cannot be archived, so defaults cannot overwrite the original data.
- Agent shells honor an explicit `GIT_CONFIG_GLOBAL`. Otherwise they read the XDG configuration and `~/.gitconfig` in Git’s order, preserving the precedence of user settings.

### Removed

- Removed the standalone installers, profile repair helpers and source synchronization script. Use the DSH plugin manager to install the plugin.

## [1.2.4] - 2026-11-24

### 修复

- 在 DSH `0.2.3-alpha.1` 上，所有者可以再次使用侧栏管理账号和授权，而不会收到 `HTTP 400`。侧栏按宿主传入的连接校验所有者身份；提供原有访问检查的宿主仍使用该检查。([#5](https://github.com/OMSociety/dsh-git-forge/pull/5))

### Fixed

- On DSH `0.2.3-alpha.1`, owners can use the sidebar to manage accounts and grants without receiving `HTTP 400`. The sidebar checks the owner identity on the connection supplied by the host. Hosts that provide the original access check still use it. ([#5](https://github.com/OMSociety/dsh-git-forge/pull/5))

## [1.2.3] - 2026-11-22

### 安全

- 侧栏 API 在读取请求正文或访问账号、授权之前执行宿主的访问检查，保留宿主返回的 `401` 或 `403` 状态码。

### 变更

- 插件清单不再限定 DSH 版本范围。

### 修复

- 右侧栏页签的图标与文字垂直居中。

### Security

- The sidebar API runs the host access check before reading the request body or accessing accounts and grants, preserving the host’s `401` or `403` status code.

### Changed

- The plugin manifest no longer restricts the DSH version range.

### Fixed

- The right sidebar tab icon is vertically centered with its label.

## [1.2.2] - 2026-11-02

### 变更

- 安装兼容范围包含 DSH `0.2.1-rc.1`。GitHub Actions 在 Linux 上检查语法并运行冒烟测试。([#2](https://github.com/OMSociety/dsh-git-forge/pull/2))

### Changed

- The installable DSH range includes `0.2.1-rc.1`. GitHub Actions checks syntax and runs smoke tests on Linux. ([#2](https://github.com/OMSociety/dsh-git-forge/pull/2))

## [1.2.1] - 2026-11-01

### 修复

- 插件停用或热替换时会卸载侧栏样式，宿主页面不会继续应用这些样式。

### Fixed

- Disabling or hot-swapping the plugin unloads its sidebar stylesheet so the host page stops applying those styles.

## [1.2.0] - 2026-10-09

### 变更

- 安装脚本要求指定已有的 DSH profile，只有显式选择修复时才改写 profile 配置。开发用的同步脚本也要求指定 `DSH_PROFILE`。

### 安全

- 侧栏 API 拒绝标记为跨站的浏览器请求。缺少 `Sec-Fetch-Site` 而提供 `Origin` 时，还会核对来源与请求主机是否一致。
- 推送检查能识别带 Git 全局选项的命令以及 `bash -lc`、`sh -c` 中的推送，同时区分提交说明里的普通文字。启用强制策略时，裸推送的目标解析重试后仍失败即拒绝。

### 修复

- Agent shell 继承用户的 Git 全局配置，包括提交身份和代理设置。通过符号链接或 Windows 短路径访问同一工作区时，使用同一份授权。
- 插件读取损坏的 JSON 配置时将原文件另存后使用默认值。GitLab 账号默认使用 `gitlab.com` 和 `https://gitlab.com/api/v4`。

### Changed

- Install scripts require an existing DSH profile and rewrite its configuration only when repair is explicitly requested. The development sync script also requires `DSH_PROFILE`.

### Security

- The sidebar API rejects browser requests marked as cross-site. If `Sec-Fetch-Site` is absent but `Origin` is present, it checks that the origin matches the request host.
- Push checks recognize Git global options and pushes inside `bash -lc` and `sh -c`, while distinguishing ordinary text in commit messages. With enforcement enabled, a bare push is denied if its target still cannot be resolved after a retry.

### Fixed

- Agent shells inherit the user’s global Git configuration, including commit identity and proxy settings. Accessing the same workspace through a symlink or a Windows short path uses the same grants.
- When reading corrupt JSON configuration, the plugin archives the original file before using defaults. GitLab accounts default to `gitlab.com` and `https://gitlab.com/api/v4`.

## [1.1.0] - 2026-10-09

### 变更

- 「Git 凭据」面板移至 DSH 官方右侧栏，不再依赖 `dsh-better-sidebar`。所需 DSH 最低版本为 `0.2.0-rc.2`。
- 侧栏按会话标识打开项目授权，由宿主确定工作区，而不是由客户端提供目录。

### Changed

- The Git Credentials panel moved to the official DSH right sidebar and no longer requires `dsh-better-sidebar`. The minimum DSH version is `0.2.0-rc.2`.
- The sidebar opens project grants by session ID. The host determines the workspace instead of accepting a directory from the client.

## [1.0.1] - 2026-10-04

### 新增

- 插件列表和侧栏共用铁砧与 Git 分支图标；插件名称和说明支持中文和英文。

### 变更

- DSH 兼容范围为 `>=0.1.7-rc.2 <0.3.0-0`，包括 DSH 0.2 系列。

### 修复

- Git for Windows 上的 HTTPS 操作可以在无人值守的 agent shell 中调用凭据助手：系统凭据选择器不会弹窗阻塞，Node.js 或助手路径中包含空格也可正常运行。
- 安装脚本默认安装本仓库的插件，并检查 Node.js 主版本；本地源码通过 DSH 插件管理器登记。宿主缺少 shell 环境或策略提示服务时，插件会记录警告。

### Added

- The plugin list and sidebar share an anvil and Git branch icon. The plugin name and description are available in Chinese and English.

### Changed

- The DSH compatibility range is `>=0.1.7-rc.2 <0.3.0-0`, including the DSH 0.2 series.

### Fixed

- HTTPS operations on Git for Windows can invoke the credential helper in unattended agent shells: the system credential picker does not block on a dialog, and spaces in the Node.js or helper path are handled correctly.
- Install scripts select this repository’s plugin by default and check the Node.js major version. Local source checkouts are registered through the DSH plugin manager. The plugin logs a warning when the host lacks the shell environment or policy prompt service.

## [1.0.0] - 2026-09-28

### 变更

- 安装要求 Node.js 20 或更高版本；插件声明的 DSH 兼容范围为 `>=0.1.2-rc.1 <0.2.0`。

### 修复

- Windows 上判断项目路径是否位于工作区内时，能正确处理大小写、路径分隔符和盘符根目录。

### Changed

- Installation requires Node.js 20 or later. The declared DSH compatibility range is `>=0.1.2-rc.1 <0.2.0`.

### Fixed

- Workspace containment checks on Windows correctly handle case, path separators and drive roots.

## [0.1.5] - 2026-09-08

### 修复

- 侧栏可以在 DSH `0.1.2` 上加载；客户端只要求宿主提供实际使用的语言服务。

### Fixed

- The sidebar can load on DSH `0.1.2`. The client requires only the locale service it uses from the host.

## [0.1.4] - 2026-08-18

### 修复

- 在工作区内的子仓运行 Git 时，凭据助手按 `DSH_GIT_FORGE_PROJECT` 取用会话工作区的授权；缺少该变量时，从当前目录向上查找工作区授权。
- `git push` 和 `git push origin` 会先解析远程地址，再检查目标主机是否获准推送。

### Fixed

- When Git runs in a repository nested inside a workspace, the helper uses `DSH_GIT_FORGE_PROJECT` to find the session workspace grants. Without that variable, it searches parent directories for workspace grants.
- `git push` and `git push origin` resolve the remote URL before checking whether its host is authorized for pushes.

## [0.1.3] - 2026-08-18

### 新增

- Agent shell 中的 HTTPS Git 可通过宿主凭据助手认证。只有目标主机恰好有一个已授权 token 账号时，助手才提供凭据；token 不进入模型上下文。
- 健康检查显示凭据助手状态、Git 配置路径和该配置是否生效。

### Added

- HTTPS Git in agent shells can authenticate through the host credential helper. It supplies credentials only when exactly one token account is granted for the target host. Tokens do not enter the model context.
- The health check reports the credential helper status, the Git configuration path and whether that configuration is active.

## [0.1.2] - 2026-08-18

### 修复

- 标准对话可以使用 `GitForge` 工具。健康检查看得到工具注册状态和实际插件版本。

### Fixed

- Standard chat sessions can use the `GitForge` tool. The health check shows its registration status and the installed plugin version.

## [0.1.1]

### 新增

- 提供命令行和 PowerShell 安装脚本，可从 GitHub 安装插件。
- Gitea 和 GitLab 账号可直接填写站点根地址，插件补全 API 路径。账号行显示探测结果，失败时给出请求地址和原因；探测超时为 10 秒。

### Added

- Shell and PowerShell install scripts can install the plugin from GitHub.
- Gitea and GitLab accounts accept the site root and fill in the API path. Each account row shows the probe result, including the request URL and reason on failure. Probes time out after 10 seconds.

## [0.1.0]

### 新增

- 在 `dsh-better-sidebar` 中管理 GitHub、Gitea、GitLab、Gitee 和 Bitbucket 账号，并为每个项目选择可用账号。
- 开启推送限制后，宿主按授权主机检查 `git push`、`git remote add`、`git remote set-url`。`GitForge` 工具供模型查询项目策略。

### Added

- Manage GitHub, Gitea, GitLab, Gitee and Bitbucket accounts in `dsh-better-sidebar` and select which accounts each project can use.
- With push enforcement enabled, the host checks `git push`, `git remote add` and `git remote set-url` against authorized hosts. The `GitForge` tool lets the model query project policy.
