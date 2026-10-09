# Changelog

本项目的更改记录在此文件。

All notable changes to this project are documented in this file.

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-09

### 新增

- **`.gitattributes`**：`* text=auto eol=lf`、`*.ps1 eol=crlf`、`docs/logo.png binary`，跨平台检出换行一致。

### 变更

- **补录 1.1.0 之后发布的三笔变更**（7c3ffdb / 8985418 / e631ade）：
  - 安装说明收敛为 npm 单一写法，版本徽章改 npm 源；
  - 安装脚本 `--profile` / `-Profile` 必填，缺失或不存在时列出实存 profile 并退出 2；
  - 安装脚本抽出 `scripts/lib/*.cjs` 助手（ws-exclude / bundle-check / strip-mount），profile 配置改写收进 `--fix-profile` 显式开关（幂等、写后回读断言）。
- **`dsh.client.inject` 双写齐备**：`@deepseek-ai/dsh-client-locale` 与 `@deepseek-ai/dsh-client-ui-sidebar-right` 同时声明（两个 peer 此前已在 `peerDependencies` 里）。
- **`sync-to-dsh.sh` 的 `DSH_PROFILE` 必填**（桌面版为 `desktop`），空值报错退出 2；README 的开发与环境要求段落同步照实。

### 修复

- **侧栏 API 同源校验**：`Sec-Fetch-Site: cross-site` 一律拒绝；请求缺该头时校验 `Origin` 与 `Host` 是否一致；宿主信任列表经 `webRuntime` 可选注入读取。
- **push 检测锚定子命令**：`git` 之后跳过全局旗标与环境变量赋值再取子命令，`bash -lc` / `sh -c` 的引号载荷递归分类——引号里的 push 逃不过检测，commit message 与普通文字里的 "push" 触发误报。
- **裸 push 放行链收紧**：remote 解析失败重试一次，仍失败且项目开启 enforce 时拒绝（fail-closed）。
- **`GIT_CONFIG_GLOBAL` 回接用户全局配置**：生成的 gitconfig 首行 `include` 用户级 gitconfig，`user.name` / `user.email` / `http.proxy` 照常生效；空 `helper =` 的清空语义在 include 顺序下经实测保持正确。
- **配置文件损坏隔离**：解析失败时把坏文件改名保留为 `<原名>.corrupt-<时间戳>` 并回退默认值，现场不丢。
- **项目 key realpath 归一**：存在路径经 `realpathSync` 折叠 Windows 8.3 短名与符号链接；自检新增幂等回归。
- **gitlab 默认值补全**：`PROVIDER_DEFAULTS.gitlab` → `gitlab.com` / `https://gitlab.com/api/v4`，与 README 对齐。
- **脚本修复**：strip-mount 按 `/\r?\n/` 切分并保留原 EOL 风格，id 匹配改 `(?![\w-])` 防止前缀误删；bundle-check 检出 ignoredBuilds 退非 0；npm/pnpm registry 查询限时（bash `timeout`、PowerShell `Start-Job`）；安装后验证提示改文件级核验；`npm test` 注释、0600 的 POSIX 口径、helper 进程表述等文档修正。
- **文案与清理**：token 提示照实写落盘位置（`$DSH_HOME/git-forge/secrets.json`），footer 照实写认证归属（HTTPS 由本插件 helper，SSH 仍走系统 SSH）；摘除未接线的 `openOfficial` 与 `joinUnderRoot`。

### Changed

- **Backfill of three changes shipped after 1.1.0** (7c3ffdb / 8985418 / e631ade):
  - install docs collapsed to the npm path and version badges switched to npm;
  - install scripts require `--profile` / `-Profile`; a missing or unknown profile lists the existing ones and exits 2;
  - install scripts extract `scripts/lib/*.cjs` helpers (ws-exclude / bundle-check / strip-mount) and gate profile rewrites behind an explicit, idempotent `--fix-profile` with write-back verification.
- **`dsh.client.inject` declares both packages**: `@deepseek-ai/dsh-client-locale` and `@deepseek-ai/dsh-client-ui-sidebar-right` (both were already peers in `peerDependencies`).
- **`sync-to-dsh.sh` requires `DSH_PROFILE`** (`desktop` for the desktop app); an empty value errors with exit 2. The README development and requirements sections follow suit.

### Fixed

- **Sidebar API same-origin checks**: `Sec-Fetch-Site: cross-site` is always rejected; when the header is absent, `Origin` must match the `Host` header; the host trust list is read through an optional `webRuntime` injection.
- **Push detection anchors the subcommand**: global flags and env assignments after `git` are skipped before the subcommand is read, and quoted payloads of `bash -lc` / `sh -c` are classified recursively — a push inside quotes is caught, while "push" inside commit messages or prose no longer triggers false positives.
- **Bare-push resolution chain tightened**: a failed remote resolution retries once and then rejects when the project enforces grants (fail-closed).
- **`GIT_CONFIG_GLOBAL` reconnects the user's global config**: the generated gitconfig `include`s the user-level gitconfig on its first line, so `user.name` / `user.email` / `http.proxy` keep working; the empty `helper =` reset semantics hold under that include order (verified empirically).
- **Corrupt config quarantine**: a config file that fails to parse is renamed to `<name>.corrupt-<timestamp>` and defaults take over, preserving the evidence.
- **Project keys realpath-normalized**: existing paths collapse through `realpathSync`, folding Windows 8.3 short names and symlinks; a smoke-test regression covers idempotence.
- **gitlab defaults completed**: `PROVIDER_DEFAULTS.gitlab` → `gitlab.com` / `https://gitlab.com/api/v4`, matching the README.
- **Script fixes**: strip-mount splits on `/\r?\n/` and preserves the file's EOL style, and its id match uses `(?![\w-])` to avoid over-deleting prefixed ids; bundle-check exits non-zero when ignoredBuilds is detected; npm/pnpm registry lookups are time-bounded (bash `timeout`, PowerShell `Start-Job`); the post-install verification hint is file-based; plus documentation corrections (`npm test` description, POSIX-only `0600` wording, helper process wording).
- **Wording and cleanup**: the token hint states the real on-disk location (`$DSH_HOME/git-forge/secrets.json`) and the footer states the real auth ownership (HTTPS via this plugin's helper, SSH stays with the system); the unwired `openOfficial` and `joinUnderRoot` were removed.

## [1.1.0] - 2026-10-09

### 变更

- **面板挂到 DSH 官方右侧栏。** `lib/client.js` 的挂载从第三方侧栏宿主的 `registerTab` 换成官方 `sidebarRightTabs.register` 加 `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title` 两个席位：座位正文与标题由框架注入 owner props（`sessionId`、`useTabInfo`），引导页入口带自己的说明文字（`guideDesc`，中英各一条）。`package.json` 移除 `dsh-better-sidebar` peer 与两个相关关键词，新增 `@deepseek-ai/dsh-client-ui-sidebar-right` peer。
- **客户端不再向宿主端传 `cwd`。** `getProjectContext` 只带 `sessionId`，会话工作区由宿主从会话 header 解析；原先客户端拿侧栏宿主的 `scope.cwd` 当回退提示。
- **DSH 版本下限抬到 `0.2.0-rc.2`。** `engines.dsh` 与 `@deepseek-ai/dsh-client-locale` peer 同步收窄为 `>=0.2.0-rc.2 <0.3.0-0`。

### Changed

- **The panel now mounts into the DSH right sidebar.** `lib/client.js` swaps the third-party sidebar host's `registerTab` for the official `sidebarRightTabs.register` plus the `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title` seats: the framework injects the pane's owner props (`sessionId`, `useTabInfo`) and the guide-page entry carries its own description (`guideDesc`, one line per language). `package.json` drops the `dsh-better-sidebar` peer and its two keywords, and gains a `@deepseek-ai/dsh-client-ui-sidebar-right` peer.
- **The client no longer sends `cwd` to the host.** `getProjectContext` carries `sessionId` only and the host resolves the session workspace from the session header; the client previously passed the sidebar host's `scope.cwd` as a fallback hint.
- **The DSH floor is raised to `0.2.0-rc.2`.** `engines.dsh` and the `@deepseek-ai/dsh-client-locale` peer narrow to `>=0.2.0-rc.2 <0.3.0-0` together.

## [1.0.1] - 2026-10-04

### 新增

- 插件有了自己的图标：包根 `icon.svg`（36×36，橙红渐变铁砧 + 白色分支负形），由 `package.json` 顶层 `icon` 字段声明并列入 `files`。插件列表里不再显示 DSH 的默认图形。
- 侧边栏标签图标改用同一张图：`lib/client.js` 不再自画 24 画板的节点图标，改为内联渲染 `icon.svg` 的铁砧与分支（按 36 画板绘制，再放大 1.3 倍以贴合侧边栏的视觉重量）。插件列表与侧边栏因此是同一张标。
- 插件列表里的显示名与描述有了中英两份（`locale/en.json`、`locale/zh.json` 的 `meta.title` 与 `meta.description`），中文名定为「Git 凭据管理」；`package.json` 的 `exports` 与 `files` 相应放行 `locale/*.json`。此前该处回退成包名与英文 `description`，在中文界面里中英混排。

### Added

- The plugin now ships its own icon: `icon.svg` at the package root (36×36, an orange-to-red gradient anvil with a white branch as negative space), declared through the top-level `icon` field in `package.json` and listed in `files`. The plugin list no longer falls back to the default DSH artwork.
- The sidebar tab icon now renders the same artwork as `icon.svg` instead of a separate 24-unit node glyph: `lib/client.js` draws the anvil and branch on the 36-unit canvas and scales them 1.3× to match the sidebar's visual weight. The plugin list and the sidebar therefore carry one mark.
- The plugin's display name and description in the plugin list now ship in both languages (`meta.title` and `meta.description` in `locale/en.json` and `locale/zh.json`), with the Chinese name settled as 「Git 凭据管理」; `exports` and `files` in `package.json` admit `locale/*.json` accordingly. The list previously fell back to the package name and the English `description`, mixing languages inside a Chinese interface.

## [1.0.0] - 2026-09-28

### 变更

- **声明 DSH 兼容性元数据。** `package.json` 现携带 `dsh.manifestVersion: 1`、`engines.dsh: ">=0.1.7-rc.2 <0.3.0-0"`（作者声明的兼容 DSH 范围，与 `engines.node` 并列；后者随当前生态主流提到 `>=20`），以及覆盖同一范围的 `@deepseek-ai/dsh-client-locale` peer——它同时覆盖 0.1.7 与 0.2 两条线（0.1.7-rc.2、0.2.0-rc.1、0.2.0 及后续 0.2.x），上界写作 `<0.3.0-0` 以免放行 0.3 的预发布。自 DSH 0.1.7-rc.1 起，插件闸门会把 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 peer 范围与运行时版本比对（未声明 DSH peer 则不施加约束）——此前本插件没有任何 DSH peer，在任何宿主上都被静默放行。`dsh.manifestVersion` 与 `engines.dsh` 按清单规范仍只是声明字段。

### 修复

- **安装脚本装的是本仓库，且 node 前置检查与 `engines.node` 一致。** `scripts/install.sh` / `scripts/install.ps1` 的 `GITHUB_REPO` 默认值此前仍指向上游仓库 `thirsty5034/dsh-git-forge`，按脚本安装拿到的是上游最后发布的 v0.1.5（无 DSH 兼容声明、无 Windows 路径修复）；现在默认本仓库。两处 node 检查此前只判断「命令存在」并提示 `>= 18`，现在按 `engines.node` 真正校验主版本（`>= 20`）。
- **本地同步脚本改走官方入口。** `scripts/sync-to-dsh.sh` 此前把文件复制进 `$DSH_HOME/local-plugins/dsh-git-forge`，而当前运行时不读取该目录（对整棵运行时搜索 `local-plugins` 零命中），等于静默无效；现在改为 `dsh plugin --profile <profile> add "link:<repo>"`，由 DSH 自己登记 `dsh.profile.bundles`。
- **可选服务缺失时不再静默降级。** `shellEnv` / `systemPrompt` 不可用时，`DSH_GIT_FORGE_*` 提示变量与策略提示段都不会注册，此前没有任何日志；现在各打印一行 `[dsh-git-forge]` 警告，便于区分「宿主缺该服务」与「插件没生效」。
- **`@deepseek-ai/cordis` peer 对齐到验证过的版本。** 从 `^4.0.1` 改为 `^4.0.4`（运行时实装 4.0.4，0.2.0-rc.1 的 locale 包亦声明 `~4.0.4`），使声明不再早于实测版本。
- **路径包含判断在 Windows 上恢复正常。** `isPathInsideRoots` 用 `root + '/'` 拼前缀且大小写敏感地比较，而 `normalizeProjectKey` 返回平台原生形态的键——于是 Windows 上所有包含判断全部失败，连 `C:\ws\child` 在 `C:\ws` 内也判为否。现在包含判断在「统一分隔符、Win32 折叠大小写」的比较形态上进行；存储的键保持平台原生形态不变。`normalizeProjectKey` 也会在不破坏 `C:\` 盘符根的前提下剥掉结尾反斜杠。
- **自检用例可移植。** `normalizeProjectKey` / `resolveGrantsProjectKey` / `resolveHelperProjectKey` 三处夹具硬编码 POSIX 路径，导致 `node scripts/smoke-test.mjs` 在任何 Windows 检出上固定挂 3 个用例。夹具现在经 `normalizeProjectKey` 推导期望值，并新增分隔符处理的回归用例。
- **Git for Windows 下 agent 的 HTTPS git 不再永久卡死，且凭据 helper 现在真正会执行**。Git for Windows 在系统级 gitconfig 注册了 GUI 程序 `credential.helper = helper-selector`，而各配置层的 helper 是**叠加**的，于是它会排在本插件 helper **前面**被执行，在无头 agent shell 里弹出无人可答的对话框、永久阻塞。除此之外，生成的 gitconfig 里 `!<cmd>` helper 行的内层引号会被 gitconfig 解析器吞掉：`!"C:\Program Files\nodejs\node.exe" "…"` 解析后只剩下*未加引号*的 `C:\Program Files\nodejs\node.exe`，shell 于是在空格处切分，git 报 `line 1: C:Program: command not found`——helper 根本没有执行过。`ensureHelperGitconfig()` 现在会在插件 helper 之前写入一行空的 `helper =`（清空此前累积的所有 `credential.helper`，从而丢弃系统级 selector），并把 helper 命令的内层引号转义为 `\"`；此前那套 `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` 注入已移除，因为那些键根本到不了 agent shell，只剩下一个没有对应键的 `GIT_CONFIG_COUNT`，使每一条 git 命令都以 `fatal: unable to parse command-line config` 失败。修复仅限生成的 gitconfig（`$DSH_HOME/git-forge/gitconfig`）。

### Changed

- **Declare DSH compatibility metadata.** `package.json` now carries `dsh.manifestVersion: 1`, `engines.dsh: ">=0.1.7-rc.2 <0.3.0-0"` (the author-declared compatible DSH range, sitting beside `engines.node`, which is raised to `>=20` like current ecosystem plugins), and a `@deepseek-ai/dsh-client-locale` peer over the same range — it covers the 0.1.7 and 0.2 lines alike (0.1.7-rc.2, 0.2.0-rc.1, 0.2.0 and later 0.2.x), with `<0.3.0-0` as the upper bound so that 0.3 prereleases stay out. Since DSH 0.1.7-rc.1 the plugin gate compares `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer ranges against the running runtime (missing peers impose no constraint) — without a DSH peer this plugin passed every host silently. `dsh.manifestVersion` and `engines.dsh` stay declarative, as the manifest spec defines them.

### Fixed

- **The install scripts install this repository, and the node precheck matches `engines.node`.** Their `GITHUB_REPO` default still pointed at the upstream `thirsty5034/dsh-git-forge`, so running them fetched the upstream v0.1.5 — no DSH compatibility declarations, no Windows path fix; they now default to this repository. Both node checks only tested that the command exists and said `>= 18`; they now verify the major version against `engines.node` (`>= 20`).
- **The local sync script uses the official entry point.** `scripts/sync-to-dsh.sh` copied files into `$DSH_HOME/local-plugins/dsh-git-forge`, a directory the current runtime never reads (searching the whole runtime for `local-plugins` returns nothing), so it was silently a no-op; it now runs `dsh plugin --profile <profile> add "link:<repo>"` and lets DSH register `dsh.profile.bundles` itself.
- **Optional services no longer degrade silently.** When `shellEnv` / `systemPrompt` are unavailable, the `DSH_GIT_FORGE_*` hints and the policy section are not registered — previously with no log at all. Each now prints a one-line `[dsh-git-forge]` warning, so "the host lacks that service" is distinguishable from "the plugin did nothing".
- **The `@deepseek-ai/cordis` peer is aligned with the tested version.** It moves from `^4.0.1` to `^4.0.4` (the runtime ships 4.0.4 and the 0.2.0-rc.1 locale package declares `~4.0.4`), so the declaration no longer reaches back before what has been verified.
- **Path containment checks now work on Windows.** `isPathInsideRoots` built its prefix as `root + '/'` and compared case-sensitively, while `normalizeProjectKey` returns platform-native keys — so on Windows every containment check failed, even `C:\ws\child` inside `C:\ws`. Containment is now judged on a separator-unified comparison form (case-folded on Win32); stored keys keep their platform-native shape. `normalizeProjectKey` also strips a trailing backslash without breaking `C:\` drive roots.
- **Smoke tests are platform-portable.** The `normalizeProjectKey` / `resolveGrantsProjectKey` / `resolveHelperProjectKey` fixtures hard-coded POSIX paths, so `node scripts/smoke-test.mjs` failed 3 tests on any Windows checkout. Fixtures now derive expectations through `normalizeProjectKey`, and a regression test covers separator handling.
- **Agent HTTPS git no longer hangs on Git for Windows, and the credential helper now actually runs.** Git for Windows registers a GUI `credential.helper = helper-selector` in its system gitconfig, and helpers accumulate across config scopes, so the selector ran **before** this plugin’s helper and blocked forever on a dialog that a headless agent shell can never answer. On top of that, the `!<cmd>` helper line in the generated gitconfig had its inner quotes swallowed by the gitconfig parser: `!"C:\Program Files\nodejs\node.exe" "…"` survived parsing as the *unquoted* `C:\Program Files\nodejs\node.exe`, so the shell split it and git reported `line 1: C:Program: command not found` — the helper never ran at all. `ensureHelperGitconfig()` now writes an empty `helper =` line — which clears every `credential.helper` accumulated so far, dropping the system-level selector — before the plugin helper, and escapes the helper command’s inner quotes as `\"`; the earlier `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` injection was removed because those keys never reached agent shells, leaving a `GIT_CONFIG_COUNT` with no matching keys and making every git command fail with `fatal: unable to parse command-line config`. The fix is confined to the generated gitconfig (`$DSH_HOME/git-forge/gitconfig`).

## [0.1.5] - 2026-09-08

### 修复

- 从 `dsh.client.inject` 移除 **`@deepseek-ai/dsh-client-runtime`**。该包在 DSH 0.1.2 已删除（社区升级卡 `DSH-0.1.2-A1-25`）；保留该幻影依赖会让 client 装配行在 0.1.2 宿主上 pending / 进不了 boot graph。保留 `@deepseek-ai/dsh-client-locale`（提供 `ctx.locale`）。首个打 tag 的版本——同时覆盖 0.1.4 期的功能（R1 Host 凭据 helper、GitForge 模型工具注册、monorepo 项目 key）。

### Fixed

- Remove **`@deepseek-ai/dsh-client-runtime`** from `dsh.client.inject`. The package was deleted in DSH 0.1.2 (community upgrade card `DSH-0.1.2-A1-25`); keeping the phantom in `inject` left the client assembly row pending / out of the boot graph on 0.1.2 hosts. `@deepseek-ai/dsh-client-locale` is retained (provides `ctx.locale`). First tagged release — also covers the 0.1.4-era features (R1 Host credential helper, GitForge model-tool registration, monorepo project key).

## [0.1.4] - 2026-08-18

### 修复

- agent shell 注入 **`DSH_GIT_FORGE_PROJECT`**（会话工作区），子仓 cwd 仍用工作区授权
- helper 在无 env 时 **向上匹配** `/workspace` 下 grants key
- push guard 对裸 **`git push` / `git push origin`** 同步解析 `remote get-url` 再裁决
- 文档与 `get_policy` 补充 project key 来源与 `list_accounts`

### Fixed

- Inject **`DSH_GIT_FORGE_PROJECT`** (session workspace) into agent shells so monorepo subfolder `git` cwd still uses workspace grants
- Credential helper **walks parent dirs** under `/workspace` when env is unset
- Push guard resolves **bare `git push` / `git push origin`** via `git remote get-url` before policy check
- Docs + `get_policy` describe project key sources and `list_accounts`

## [0.1.3] - 2026-08-18

### 新增

- **Agent HTTPS git 认证**：Host 侧 credential helper + `$DSH_HOME/git-forge/gitconfig`（`GIT_CONFIG_GLOBAL`），agent bash 中的 `git` 可透明使用侧栏已授权账号
- **R1 选号**：同一 host 仅当恰好 1 个已授权 token 账号时自动注入；token 永不进模型上下文
- health：`gitCredentialHelper` / `gitconfigPath` / `gitConfigGlobalActive`

### Added

- **Agent HTTPS git auth** via Host-only git credential helper (`scripts/git-credential-dsh-git-forge.mjs`) and `$DSH_HOME/git-forge/gitconfig` (`GIT_CONFIG_GLOBAL` for agent shells)
- **R1 account selection**: exactly one authorized token account per remote host; tokens never enter model context
- Health: `gitCredentialHelper`, `gitconfigPath`, `gitConfigGlobalActive`

## [0.1.2] - 2026-08-18

### 修复

- **GitForge 作为全局模型工具正确注册**（不再依赖 out-of-tree 解析 `@deepseek-ai/dsh-tools` 的 `defineTool`；改用与 modlens / dsh-ssh-tunnel 相同的裸 JSON Schema + 必填 `output`）。此前标准对话工具列表中看不到该工具。
- `health.version` 与 `package.json` 对齐；`health.gitForgeRegistered` 报告注册状态

### Fixed

- **GitForge registers as a global model tool** without importing `@deepseek-ai/dsh-tools` (raw JSON-Schema definition + required `output`, same pattern as modlens / dsh-ssh-tunnel). Out-of-tree `defineTool` resolution left the tool missing from standard chat catalogs.
- `health.version` tracks `package.json`; `health.gitForgeRegistered` reports registration status

## [0.1.1]

### 变更

- 对齐 dsh-better-sidebar 的公开仓库结构
- 增加 `scripts/install.sh` / `install.ps1`（默认 GitHub；`--from npm` 预留）
- package.json：`repository` / `homepage` / `bugs` / `publishConfig`

### 新增

- Gitea/GitLab：保存/探测时自动补全 API 路径（站点根 → `/api/v1` 或 `/api/v4`）
- 探测增加 10s 超时，返回具体 URL 与失败原因
- 账号行内显示探测成功/失败

### Changed

- Public GitHub repo layout aligned with dsh-better-sidebar
- `scripts/install.sh` / `install.ps1` (GitHub default; `--from npm` ready)
- package.json: `repository` / `homepage` / `bugs` / `publishConfig`

### Added

- Auto-normalize Gitea/GitLab API bases (site root → `/api/v1` or `/api/v4`)
- Probe timeout (10s) with explicit URL/error text
- Inline per-account probe result in the sidebar

## [0.1.0]

### 新增

- 首版：better-sidebar「Git 凭据」Tab
- 账号库（GitHub / Gitea / GitLab / Gitee / Bitbucket）
- 按项目授权 + enforce push
- Host `tools.guard` 拦截未授权 `git push` / `git remote add|set-url`
- 模型工具 `GitForge`
- UI 对齐 dsh-ssh-tunnel

### Added

- Initial release: better-sidebar **Git Forge** tab
- Account library (GitHub / Gitea / GitLab / Gitee / Bitbucket)
- Per-project grants + enforce push
- Host `tools.guard` for unauthorized `git push` / `git remote add|set-url`
- Model tool `GitForge`
- UI aligned with dsh-ssh-tunnel
