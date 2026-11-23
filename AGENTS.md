# AGENTS.md

DSH 插件：Forge 账号库、按项目授权、push 拦截，并让 agent shell 里的 HTTPS git 自动取用授权账号的 token。功能与安装见 [README.md](README.md)（英文 [README_en.md](README_en.md)），发版史见 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

纯 JavaScript（ESM），Node >= 20，零运行时依赖，没有构建步骤；`lib/client.js` 直接编辑、直接入库（仓库内无对应源码目录，提交历史也是直接改它）。

## 常用命令

| 目的 | 命令 |
|---|---|
| 离线自检（27 项） | `npm test` |
| 语法检查加自检 | `npm run check` |
| 核对发布物清单 | `npm run check:pack` |
| 重出 README 预览图 | `npm run build:preview`（需本机 Chrome，`CHROME_PATH` 可指定） |
| 单文件语法检查 | `node --check lib/index.js` |

## 验收标准

与 `.github/workflows/ci.yml` 一致，全部通过才算完成：

```bash
find lib scripts -type f ( -name '*.js' -o -name '*.cjs' -o -name '*.mjs' ) -exec node --check {} \;
npm test
npm run check:pack
```

## 架构边界

```text
lib/client.js（浏览器侧侧栏）──fetch──▶ lib/index.js（宿主：路由 + 工具 + 拦截）──▶ lib/shared/（纯函数，宿主与客户端共用）
git ──拉起──▶ scripts/git-credential-dsh-git-forge.mjs（独立进程，按需读 secrets.json）
```

- `lib/shared/` 只放不碰文件系统与网络的纯函数（path / git-policy / remote-resolve / credential-select / account-summary），客户端也会用到。
- 宿主入口 `lib/index.js` 的 `inject` 为 `['webServer','connection','sessions','tools']`；服务只经 `ctx` 取，不在模块顶层访问。
- 工具用 `ctx.tools.register` 注册 raw JSON-Schema，不依赖 `defineTool`。
- push 策略在 `ctx.tools.guard` 里硬拦截，不依赖模型自觉。

## 修改契约

| 改动 | 必须动作 | 通过标准 |
|---|---|---|
| `package.json` 的 `files` 白名单或 `exports` | 跑 `npm run check:pack` | 清单与声明一致；漏项在源码树里测不出，只有发布包会少文件 |
| `lib/index.js` 的 API 路由、拦截、helper 配置 | 在 `scripts/smoke-test.mjs` 补用例 | `npm test` 全绿 |
| `lib/client.js` 的界面 | 跑 `npm run build:preview` 并提交 `docs/panel-*.png`、`docs/preview/panel.html` | 预览图由 `lib/client.js` 加 `docs/preview/fixture.json`（虚构数据）渲染，界面改动后须同步 |
| `lib/shared/*` | 同步检查 `lib/client.js` 是否复制了同样逻辑 | 两侧行为一致 |
| 版本号 | `package.json`、README 与 README_en 的安装示例 `dsh-git-forge@x.y.z`、CHANGELOG 条目同次提交 | 三处版本一致 |
| README 的用例数等事实 | 与 `npm test` 实际输出一致 | 数字相符 |

## 硬约束

1. **授权 key 是 DSH 会话工作区**（agent shell 里的 `DSH_GIT_FORGE_PROJECT`），不是子仓路径；路径经 `normalizeProjectKey` 按磁盘实态归一。
2. **R1**：同一 host 仅当恰好 1 个已授权 token 账号时才自动注入凭据；多账号不猜号。
3. **侧栏 API 准入有两代宿主**：`connection.requestRejection` 存在（`@deepseek-ai/dsh-client-connection` <= 0.2.2-rc.5，WebServer 不传 Peer）时沿用它；不存在（>= 0.2.3-alpha.1）时要求 handler 第三参 Peer 的 `principal.kind === 'owner'`，否则 403。入口是 `lib/index.js` 的 `createApiHandler`。
4. **EOL**：`.gitattributes` 规定 `eol=lf`，仅 `*.ps1` 为 CRLF；`scripts/smoke-test.mjs` 保持可执行位。

## 禁止操作

- 禁止让 token 出现在 API 响应、工具结果、日志或模型上下文里。原因：token 只应留在 `$DSH_HOME/git-forge/secrets.json`（`0600`），泄露需轮换。
- 禁止绕开 `readJson` / `writeJsonFile` 直接读写 `accounts.json`、`secrets.json`、`grants.json`。原因：解析失败时由它们把坏文件改名保留为 `.corrupt-<时间戳>` 并回退默认，直写会丢现场。
- 禁止把 `package.json` 的 `engines.dsh` 改成具体版本。原因：宿主能力差异靠运行期探测处理，不设版本闸。
- 禁止把真实凭据、内网地址写进仓库任何文件。原因：公网仓库。

## 提交与协作

- Commit：Conventional Commits 加中文描述（`fix:` / `docs:` / `chore(release):` 等），直接推 `main`；发版为单独的 `chore(release)` 提交。
- 对外文档零 emoji；提示块写 `> **提示**：`，冒号在粗体外。
- README 与 README_en 结构对等，改一边同步另一边。

## 待办（有触发条件）

- **移除旧宿主兼容分支**：DSH 0.2.3 发布 rc 版后，删除 `lib/index.js` 中 `createApiHandler` 的 `requestRejection` 分支与 `scripts/smoke-test.mjs` 里对应的旧宿主用例，把 README 与 README_en 的「侧栏 API」条目改为只描述 Peer 校验；CHANGELOG 在 Removed 章节记录。

## 维护

本文件与触发它的代码改动进同一次提交；与代码不符时先判断哪边过时。
