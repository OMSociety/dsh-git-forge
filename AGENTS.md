# AGENTS.md

## 待办（有触发条件）

- **移除旧宿主兼容分支**：lib/index.js 的 createApiHandler() 同时支持两代宿主：connection.requestRejection 存在时沿用原检查（@deepseek-ai/dsh-client-connection <= 0.2.2-rc.5，WebServer 不传 Peer）；不存在时要求 WebServer 传入的 Peer 为 owner（>= 0.2.3-alpha.1）。DSH 0.2.3 发布 rc 版后：删除 equestRejection 分支、scripts/smoke-test.mjs 中对应的旧宿主用例，并把 README.md / README_en.md 的「侧栏 API」条目改为只描述 Peer 校验；CHANGELOG 在 Removed 章节记录。
