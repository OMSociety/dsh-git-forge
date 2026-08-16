window.__ModuleLoader__.load({
	id: "dsh-git-forge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		const LOCALE_NS = "gitForge";
		const zh = {
			tabTitle: "Git 凭据",
			projectLabel: "项目: {path}",
			projectUnbound: "(未绑定)",
			refresh: "刷新",
			tabGrants: "项目授权",
			tabAccounts: "账号库",
			tabStatus: "策略状态",
			grantsHint: "勾选后，当前项目下的对话只能向这些 Forge 的 gitHost 执行 git push / 改 remote（enforce 开启时）。",
			saveGrants: "保存项目授权",
			saving: "保存中…",
			noAccountsYet: "还没有账号，请先到「账号库」添加 GitHub / Gitea 等。",
			newAccount: "新建账号",
			edit: "编辑",
			delete: "删除",
			deleteAccountConfirm: "确定删除账号「{name}」？此操作不可撤销。",
			name: "名称",
			provider: "平台",
			gitHost: "Git Host（匹配 remote）",
			apiBase: "API Base",
			authMethod: "认证方式",
			authToken: "Token（API / HTTPS）",
			authSsh: "系统 SSH（不存 token）",
			username: "用户名（可选）",
			defaultOwner: "默认 owner/org（可选）",
			token: "Token / PAT",
			tokenHint: "仅写入本机加密旁路 secrets；不会进入模型上下文。留空表示不修改已有 token。",
			clearToken: "清除 token",
			save: "保存",
			back: "返回",
			editAccount: "编辑账号",
			createAccount: "新建账号",
			probe: "探测",
			probing: "探测中…",
			apiBaseHintGitea: "可填站点根，如 https://gitea.example.com（会自动补 /api/v1）",
			enforcePush: "启用 push 拦截（推荐）",
			enforceHint: "开启后，bash 中的 git push / git remote add|set-url 若指向未授权 host 会被直接拒绝。",
			unboundAllow: "未授权项目：允许任意 remote",
			unboundDeny: "未授权项目：拒绝 push/改 remote",
			saveUnbound: "保存全局未绑定策略",
			statusTitle: "当前项目策略",
			allowedHosts: "允许的 gitHost",
			noneGranted: "（未授权任何账号 — 默认不拦截，除非全局改为拒绝）",
			footerHint: "账号与项目授权在此侧栏完成；token 永不进对话。系统 git/ssh 仍负责真实认证。",
			credentialSaved: "已配置",
			credentialMissing: "未配置 token",
			credentialSsh: "SSH",
			providers: {
				github: "GitHub",
				gitea: "Gitea",
				gitlab: "GitLab",
				gitee: "Gitee",
				bitbucket: "Bitbucket",
			},
			ok: "确定",
			cancel: "取消",
			saved: "已保存",
			probeOk: "探测成功：{message}",
			probeFail: "探测失败：{message}",
		};
		const en = {
			tabTitle: "Git Forge",
			projectLabel: "Project: {path}",
			projectUnbound: "(not bound)",
			refresh: "Refresh",
			tabGrants: "Project access",
			tabAccounts: "Accounts",
			tabStatus: "Policy",
			grantsHint: "Checked accounts may receive git push / remote changes from this project's agent sessions when enforce is on.",
			saveGrants: "Save project access",
			saving: "Saving…",
			noAccountsYet: "No accounts yet — add GitHub / Gitea under Accounts.",
			newAccount: "New account",
			edit: "Edit",
			delete: "Delete",
			deleteAccountConfirm: "Delete account \"{name}\"? This cannot be undone.",
			name: "Name",
			provider: "Provider",
			gitHost: "Git host (matches remotes)",
			apiBase: "API base",
			authMethod: "Auth method",
			authToken: "Token (API / HTTPS)",
			authSsh: "System SSH (no stored token)",
			username: "Username (optional)",
			defaultOwner: "Default owner/org (optional)",
			token: "Token / PAT",
			tokenHint: "Stored only in local secrets; never enters the model context. Leave blank to keep an existing token.",
			clearToken: "Clear token",
			save: "Save",
			back: "Back",
			editAccount: "Edit account",
			createAccount: "New account",
			probe: "Probe",
			probing: "Probing…",
			apiBaseHintGitea: "Site root is fine, e.g. https://gitea.example.com (/api/v1 is added automatically)",
			enforcePush: "Enforce push guard (recommended)",
			enforceHint: "When on, bash git push / git remote add|set-url to non-granted hosts is denied.",
			unboundAllow: "Unbound projects: allow any remote",
			unboundDeny: "Unbound projects: deny push/remote writes",
			saveUnbound: "Save unbound policy",
			statusTitle: "Current project policy",
			allowedHosts: "Allowed git hosts",
			noneGranted: "(no accounts granted — default allow unless unbound policy is deny)",
			footerHint: "Manage accounts and per-project grants here. Tokens never enter chat. Real git auth still uses system SSH/GCM.",
			credentialSaved: "configured",
			credentialMissing: "token missing",
			credentialSsh: "SSH",
			providers: {
				github: "GitHub",
				gitea: "Gitea",
				gitlab: "GitLab",
				gitee: "Gitee",
				bitbucket: "Bitbucket",
			},
			ok: "OK",
			cancel: "Cancel",
			saved: "Saved",
			probeOk: "Probe ok: {message}",
			probeFail: "Probe failed: {message}",
		};

		let localeService;
		function attachLocale(service) {
			localeService = service;
		}
		function activeLocale() {
			const fromSvc = localeService && localeService.getSnapshot ? localeService.getSnapshot().active : undefined;
			const raw = fromSvc || (typeof navigator !== "undefined" ? navigator.language : "") || "en";
			return String(raw);
		}
		function isZh() {
			return activeLocale().toLowerCase().startsWith("zh");
		}
		function t(key, params) {
			const dict = isZh() ? zh : en;
			let text = dict[key];
			if (text === undefined && key.indexOf(".") >= 0) {
				const parts = key.split(".");
				let cur = dict;
				for (let i = 0; i < parts.length; i++) {
					cur = cur && cur[parts[i]];
				}
				text = cur;
			}
			if (text === undefined) {
				const enDict = en;
				text = enDict[key];
				if (text === undefined && key.indexOf(".") >= 0) {
					const parts = key.split(".");
					let cur = enDict;
					for (let i = 0; i < parts.length; i++) cur = cur && cur[parts[i]];
					text = cur;
				}
			}
			if (text === undefined) text = key;
			if (params !== undefined && params !== null) {
				for (const [name, value] of Object.entries(params)) {
					text = String(text).split("{" + name + "}").join(String(value));
				}
			}
			return text;
		}

		const TAB_ID = "dsh-git-forge";
		const API = "/dsh-git-forge/api";
		const STYLE_ID = "dsh-git-forge-style";

		async function api(method, body) {
			const response = await fetch(API + "/" + method, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body || {}),
			});
			const text = await response.text();
			let data;
			try { data = text ? JSON.parse(text) : {}; }
			catch (e) { throw new Error("bad JSON (" + response.status + "): " + text.slice(0, 200)); }
			if (!response.ok && data && data.error) throw new Error(String(data.error));
			if (!response.ok) throw new Error("HTTP " + response.status);
			return data;
		}

		function icon(size) {
			const s = size || 16;
			return React.createElement("svg", {
				width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
				strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
			},
				React.createElement("circle", { cx: "6", cy: "6", r: "2.5" }),
				React.createElement("circle", { cx: "6", cy: "18", r: "2.5" }),
				React.createElement("circle", { cx: "18", cy: "12", r: "2.5" }),
				React.createElement("path", { d: "M8.5 7.5c2.5 0 5 2 5 4.5" }),
				React.createElement("path", { d: "M6 8.5v7" }),
			);
		}

		function ensureStyles() {
			const prev = document.getElementById(STYLE_ID);
			if (prev && prev.getAttribute("data-rev") === "1") return;
			if (prev) prev.remove();
			const el = document.createElement("style");
			el.id = STYLE_ID;
			el.setAttribute("data-rev", "1");
			// Mirror dsh-ssh-tunnel theme tokens / density (gf-t-* prefix)
			el.textContent = [
				".gf-t-root{display:flex;flex-direction:column;gap:14px;padding:14px 14px 18px;height:100%;overflow:auto;font-size:13px;line-height:1.45;color:var(--dsw-alias-label-primary);box-sizing:border-box;background:transparent;}",
				".gf-t-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:10px;}",
				".gf-t-title{font-weight:600;font-size:15px;letter-spacing:-0.01em;color:var(--dsw-alias-label-primary);}",
				".gf-t-sub{color:var(--dsw-alias-label-secondary);font-size:12px;word-break:break-all;margin-top:3px;opacity:1;}",
				".gf-t-tabs{display:flex;gap:4px;flex-wrap:wrap;padding:3px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;width:fit-content;}",
				".gf-t-tab{padding:6px 12px;border-radius:999px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;font-weight:500;transition:background var(--ds-transition-duration-slow, .15s) ease,color .15s ease;}",
				".gf-t-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}",
				".gf-t-tab.on{background:var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-inverted, #fff);}",
				".gf-t-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px;background:var(--dsw-alias-bg-layer-1);}",
				".gf-t-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);}",
				".gf-t-row:last-child{border-bottom:none;padding-bottom:0;}",
				".gf-t-row:first-child{padding-top:0;}",
				".gf-t-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center;}",
				".gf-t-btn{padding:7px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2, transparent);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;font-weight:500;transition:background .15s,border-color .15s;}",
				".gf-t-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2);}",
				".gf-t-btn:disabled{opacity:.45;cursor:not-allowed;}",
				".gf-t-btn.primary{background:var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-inverted, #fff);}",
				".gf-t-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill));}",
				".gf-t-btn.danger{border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent);color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);}",
				".gf-t-btn.danger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent);}",
				".gf-t-field{display:block;margin-bottom:12px;}",
				".gf-t-label{display:block;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);margin-bottom:6px;letter-spacing:0;text-transform:none;}",
				".gf-t-input,.gf-t-select,.gf-t-textarea{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;outline:none;transition:border-color .15s, box-shadow .15s;}",
				".gf-t-input:focus,.gf-t-select:focus,.gf-t-textarea:focus{border-color:var(--dsw-alias-border-l4, var(--dsw-alias-brand-primary));box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);}",
				".gf-t-ok{color:var(--dsw-alias-state-success-primary, #3d9a5f);font-size:12px;}",
				".gf-t-err{color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap;padding:8px 10px;border-radius:8px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 28%, transparent);}",
				".gf-t-muted{color:var(--dsw-alias-label-secondary);font-size:12px;}",
				".gf-t-check{display:flex;align-items:center;gap:10px;margin:8px 0;cursor:pointer;padding:8px 10px;border-radius:8px;border:1px solid transparent;color:var(--dsw-alias-label-primary);}",
				".gf-t-check:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1);}",
				".gf-t-check input{accent-color:var(--dsw-alias-brand-primary);}",
				".gf-t-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}",
				".gf-t-badge.ok{color:var(--dsw-alias-state-success-primary, #3d9a5f);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary, #3d9a5f) 35%, transparent);}",
				".gf-t-badge.warn{color:var(--dsw-alias-state-warn-primary, #d97706);border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 35%, transparent);}",
			].join("\n");
			document.head.appendChild(el);
		}

		function Btn(props) {
			const cls = "gf-t-btn" + (props.primary ? " primary" : "") + (props.danger ? " danger" : "");
			return React.createElement("button", { type: "button", className: cls, disabled: props.disabled, onClick: props.onClick }, props.children);
		}
		function Field(props) {
			return React.createElement("label", { className: "gf-t-field" },
				React.createElement("span", { className: "gf-t-label" }, props.label), props.children);
		}

		function emptyForm(defaults) {
			defaults = defaults || {};
			return {
				id: "",
				name: "",
				provider: "github",
				gitHost: (defaults.github && defaults.github.gitHost) || "github.com",
				apiBase: (defaults.github && defaults.github.apiBase) || "https://api.github.com",
				authMethod: "token",
				username: "",
				defaultOwner: "",
				token: "",
				clearToken: false,
			};
		}

		function credLabel(a) {
			if (a.credentialStatus === "ssh") return t("credentialSsh");
			if (a.credentialStatus === "saved") return t("credentialSaved");
			return t("credentialMissing");
		}

		function ForgePanel(props) {
			const visible = props.visible;
			const scope = props.scope || {};
			const [view, setView] = React.useState("grants");
			const [projectPathKey, setProjectPathKey] = React.useState("");
			const [sessionId, setSessionId] = React.useState(scope.sessionId || "");
			const [accounts, setAccounts] = React.useState([]);
			const [granted, setGranted] = React.useState([]);
			const [enforcePush, setEnforcePush] = React.useState(true);
			const [unboundPolicy, setUnboundPolicy] = React.useState("allow");
			const [defaults, setDefaults] = React.useState({});
			const [form, setForm] = React.useState(emptyForm());
			const [busy, setBusy] = React.useState("");
			const [busyId, setBusyId] = React.useState("");
			const [message, setMessage] = React.useState("");
			const [error, setError] = React.useState("");
			const [probeById, setProbeById] = React.useState({});

			const cwdGuess = scope.cwd || scope.workspacePath || "";

			const refresh = React.useCallback(async () => {
				const ctx = await api("getProjectContext", {
					sessionId: scope.sessionId || sessionId || "",
					cwd: cwdGuess || undefined,
				});
				const key = ctx.projectPathKey || cwdGuess || "/workspace";
				setProjectPathKey(key);
				if (ctx.sessionId) setSessionId(ctx.sessionId);
				const [a, g, u] = await Promise.all([
					api("listAccounts"),
					api("getGrants", { projectPathKey: key }),
					api("getUnboundPolicy"),
				]);
				setAccounts(a.accounts || []);
				setDefaults(a.defaults || {});
				setGranted(g.accountIds || []);
				setEnforcePush(g.enforcePush !== false);
				setUnboundPolicy(u.unboundPolicy || "allow");
			}, [scope.sessionId, cwdGuess, sessionId]);

			React.useEffect(() => {
				if (!visible) return;
				refresh().catch(function (e) { setError(String(e && e.message ? e.message : e)); });
			}, [visible, refresh]);

			function patchForm(p) {
				setForm(function (prev) { return Object.assign({}, prev, p); });
			}
			async function run(name, fn, opts) {
				opts = opts || {};
				setBusy(name); setBusyId(opts.id || "");
				if (!opts.keepFeedback) { setMessage(""); setError(""); }
				try {
					const result = await fn();
					if (!opts.skipRefresh) await refresh();
					// Apply feedback AFTER refresh so it is not lost to intermediate renders.
					if (result && result.okMessage) setMessage(String(result.okMessage));
					if (result && result.errMessage) setError(String(result.errMessage));
					return result;
				} catch (e) {
					setError(String(e && e.message ? e.message : e));
				} finally {
					setBusy("");
					setBusyId("");
				}
			}
			function toggleGrant(id) {
				setGranted(granted.includes(id) ? granted.filter(function (x) { return x !== id; }) : granted.concat([id]));
			}
			function onProviderChange(provider) {
				const d = defaults[provider] || {};
				patchForm({
					provider: provider,
					gitHost: d.gitHost || "",
					apiBase: d.apiBase || "",
				});
			}

			const tabs = [
				{ id: "grants", label: t("tabGrants") },
				{ id: "accounts", label: t("tabAccounts") },
				{ id: "status", label: t("tabStatus") },
			];

			const grantedAccounts = accounts.filter(function (a) { return granted.includes(a.id); });

			return React.createElement("div", { className: "gf-t-root" },
				React.createElement("div", { className: "gf-t-head" },
					React.createElement("div", null,
						React.createElement("div", { className: "gf-t-title" }, t("tabTitle")),
						React.createElement("div", { className: "gf-t-sub" }, t("projectLabel", { path: projectPathKey || t("projectUnbound") })),
					),
					React.createElement(Btn, { disabled: !!busy, onClick: function () {
						refresh().catch(function (e) { setError(String(e.message || e)); });
					} }, t("refresh")),
				),
				React.createElement("div", { className: "gf-t-tabs" },
					tabs.map(function (tab) {
						return React.createElement("button", {
							key: tab.id, type: "button",
							className: "gf-t-tab" + (view === tab.id || (view === "edit" && tab.id === "accounts") ? " on" : ""),
							onClick: function () { setView(tab.id); },
						}, tab.label);
					}),
				),
				view === "grants" ? React.createElement("div", { className: "gf-t-card" },
					React.createElement("div", { className: "gf-t-muted", style: { marginBottom: 8 } }, t("grantsHint")),
					React.createElement("label", { className: "gf-t-check" },
						React.createElement("input", {
							type: "checkbox", checked: !!enforcePush,
							onChange: function (e) { setEnforcePush(!!e.target.checked); },
						}),
						React.createElement("span", null, t("enforcePush")),
					),
					React.createElement("div", { className: "gf-t-muted", style: { marginBottom: 8 } }, t("enforceHint")),
					accounts.length === 0
						? React.createElement("div", { className: "gf-t-muted" }, t("noAccountsYet"))
						: accounts.map(function (a) {
							return React.createElement("label", { key: a.id, className: "gf-t-check" },
								React.createElement("input", {
									type: "checkbox", checked: granted.includes(a.id),
									onChange: function () { toggleGrant(a.id); },
								}),
								React.createElement("span", null,
									(a.name || a.id) + " · " + a.provider + " · " + a.gitHost + " · ",
									React.createElement("span", {
										className: "gf-t-badge" + (a.credentialStatus === "missing" ? " warn" : " ok"),
									}, credLabel(a)),
								),
							);
						}),
					React.createElement("div", { className: "gf-t-actions" },
						React.createElement(Btn, { primary: true, disabled: !!busy, onClick: function () {
							run("grants", async function () {
								await api("setGrants", {
									projectPathKey: projectPathKey,
									accountIds: granted,
									enforcePush: enforcePush,
								});
								setMessage(t("saved"));
							});
						} }, busy === "grants" ? t("saving") : t("saveGrants")),
					),
				) : null,
				view === "accounts" ? React.createElement("div", { className: "gf-t-card" },
					React.createElement("div", { className: "gf-t-actions", style: { marginTop: 0 } },
						React.createElement(Btn, { primary: true, onClick: function () { setForm(emptyForm(defaults)); setView("edit"); } }, t("newAccount")),
					),
					accounts.map(function (a) {
						const pr = probeById[a.id];
						return React.createElement("div", { key: a.id, className: "gf-t-row", style: { alignItems: "flex-start" } },
							React.createElement("div", { style: { flex: 1, minWidth: 0 } },
								React.createElement("div", { style: { fontWeight: 600 } }, a.name || a.id),
								React.createElement("div", { className: "gf-t-muted" },
									t("providers." + a.provider) + " · " + a.gitHost + (a.apiBase ? " · " + a.apiBase : ""),
								),
								React.createElement("div", { style: { marginTop: 4 } },
									React.createElement("span", {
										className: "gf-t-badge" + (a.credentialStatus === "missing" ? " warn" : " ok"),
									}, credLabel(a)),
								),
								pr ? React.createElement("div", {
									className: pr.ok ? "gf-t-ok" : "gf-t-err",
									style: { marginTop: 8 },
								}, pr.text) : null,
							),
							React.createElement("div", { className: "gf-t-actions", style: { marginTop: 0 } },
								React.createElement(Btn, { disabled: !!busy, onClick: function () {
									run("probe", async function () {
										const r = await api("probeAccount", { id: a.id });
										const ok = !!(r && r.ok);
										const text = ok
											? t("probeOk", { message: r.message || "ok" })
											: t("probeFail", { message: (r && r.message) || "failed" });
										setProbeById(function (prev) {
											const next = Object.assign({}, prev);
											next[a.id] = { ok: ok, text: text, at: Date.now() };
											return next;
										});
										return ok
											? { okMessage: text }
											: { errMessage: text };
									}, { id: a.id });
								} }, (busy === "probe" && busyId === a.id) ? t("probing") : t("probe")),
								React.createElement(Btn, { onClick: function () {
									setForm({
										id: a.id,
										name: a.name || "",
										provider: a.provider || "github",
										gitHost: a.gitHost || "",
										apiBase: a.apiBase || "",
										authMethod: a.authMethod || "token",
										username: a.username || "",
										defaultOwner: a.defaultOwner || "",
										token: "",
										clearToken: false,
									});
									setView("edit");
								} }, t("edit")),
								React.createElement(Btn, { danger: true, onClick: function () {
									if (!window.confirm(t("deleteAccountConfirm", { name: a.name || a.id }))) return;
									run("del", async function () { await api("deleteAccount", { id: a.id }); });
								} }, t("delete")),
							),
						);
					}),
				) : null,
				view === "edit" ? React.createElement("div", { className: "gf-t-card" },
					React.createElement("div", { style: { fontWeight: 600, marginBottom: 10 } }, form.id ? t("editAccount") : t("createAccount")),
					React.createElement(Field, { label: t("name") }, React.createElement("input", {
						className: "gf-t-input", value: form.name,
						onChange: function (e) { patchForm({ name: e.target.value }); },
					})),
					React.createElement(Field, { label: t("provider") },
						React.createElement("select", {
							className: "gf-t-select", value: form.provider,
							onChange: function (e) { onProviderChange(e.target.value); },
						},
							["github", "gitea", "gitlab", "gitee", "bitbucket"].map(function (p) {
								return React.createElement("option", { key: p, value: p }, t("providers." + p));
							}),
						),
					),
					React.createElement(Field, { label: t("gitHost") }, React.createElement("input", {
						className: "gf-t-input", value: form.gitHost, placeholder: "github.com / gitea.example.com",
						onChange: function (e) { patchForm({ gitHost: e.target.value }); },
					})),
					React.createElement(Field, { label: t("apiBase") }, React.createElement("input", {
						className: "gf-t-input", value: form.apiBase,
						placeholder: form.provider === "gitea" ? "https://gitea.example.com" : "https://…",
						onChange: function (e) { patchForm({ apiBase: e.target.value }); },
					})),
					form.provider === "gitea" ? React.createElement("div", { className: "gf-t-muted", style: { marginTop: -6, marginBottom: 10 } }, t("apiBaseHintGitea")) : null,
					React.createElement(Field, { label: t("authMethod") },
						React.createElement("select", {
							className: "gf-t-select", value: form.authMethod,
							onChange: function (e) { patchForm({ authMethod: e.target.value }); },
						},
							React.createElement("option", { value: "token" }, t("authToken")),
							React.createElement("option", { value: "ssh" }, t("authSsh")),
						),
					),
					React.createElement(Field, { label: t("username") }, React.createElement("input", {
						className: "gf-t-input", value: form.username,
						onChange: function (e) { patchForm({ username: e.target.value }); },
					})),
					React.createElement(Field, { label: t("defaultOwner") }, React.createElement("input", {
						className: "gf-t-input", value: form.defaultOwner,
						onChange: function (e) { patchForm({ defaultOwner: e.target.value }); },
					})),
					form.authMethod === "token" ? React.createElement(React.Fragment, null,
						React.createElement(Field, { label: t("token") }, React.createElement("input", {
							className: "gf-t-input", type: "password", value: form.token, autoComplete: "off",
							onChange: function (e) { patchForm({ token: e.target.value, clearToken: false }); },
						})),
						React.createElement("div", { className: "gf-t-muted", style: { marginBottom: 8 } }, t("tokenHint")),
						form.id ? React.createElement("label", { className: "gf-t-check" },
							React.createElement("input", {
								type: "checkbox", checked: !!form.clearToken,
								onChange: function (e) { patchForm({ clearToken: !!e.target.checked, token: "" }); },
							}),
							React.createElement("span", null, t("clearToken")),
						) : null,
					) : null,
					React.createElement("div", { className: "gf-t-actions" },
						React.createElement(Btn, { primary: true, disabled: !!busy, onClick: function () {
							run("save", async function () {
								const payload = {
									id: form.id || undefined,
									name: form.name,
									provider: form.provider,
									gitHost: form.gitHost,
									apiBase: form.apiBase,
									authMethod: form.authMethod,
									username: form.username,
									defaultOwner: form.defaultOwner,
								};
								if (form.authMethod === "token") {
									if (form.clearToken) payload.token = "";
									else if (form.token) payload.token = form.token;
								}
								await api("saveAccount", { account: payload });
								setMessage(t("saved"));
								setView("accounts");
							});
						} }, t("save")),
						React.createElement(Btn, { onClick: function () { setView("accounts"); } }, t("back")),
					),
				) : null,
				view === "status" ? React.createElement("div", { className: "gf-t-card" },
					React.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, t("statusTitle")),
					React.createElement("div", { className: "gf-t-muted" }, t("projectLabel", { path: projectPathKey || t("projectUnbound") })),
					React.createElement("div", { style: { marginTop: 10, fontWeight: 600 } }, t("allowedHosts")),
					grantedAccounts.length === 0
						? React.createElement("div", { className: "gf-t-muted" }, t("noneGranted"))
						: grantedAccounts.map(function (a) {
							return React.createElement("div", { key: a.id, className: "gf-t-row" },
								React.createElement("div", null, a.name + " · " + a.gitHost),
								React.createElement("span", { className: "gf-t-badge ok" }, a.provider),
							);
						}),
					React.createElement("div", { style: { marginTop: 14, fontWeight: 600 } }, "Global"),
					React.createElement("label", { className: "gf-t-check" },
						React.createElement("input", {
							type: "radio", name: "unbound", checked: unboundPolicy === "allow",
							onChange: function () { setUnboundPolicy("allow"); },
						}),
						React.createElement("span", null, t("unboundAllow")),
					),
					React.createElement("label", { className: "gf-t-check" },
						React.createElement("input", {
							type: "radio", name: "unbound", checked: unboundPolicy === "deny_unbound",
							onChange: function () { setUnboundPolicy("deny_unbound"); },
						}),
						React.createElement("span", null, t("unboundDeny")),
					),
					React.createElement("div", { className: "gf-t-actions" },
						React.createElement(Btn, { primary: true, disabled: !!busy, onClick: function () {
							run("unbound", async function () {
								await api("setUnboundPolicy", { unboundPolicy: unboundPolicy });
								setMessage(t("saved"));
							});
						} }, t("saveUnbound")),
					),
				) : null,
				message ? React.createElement("div", { className: "gf-t-ok" }, message) : null,
				error ? React.createElement("div", { className: "gf-t-err" }, error) : null,
				React.createElement("div", { className: "gf-t-muted" }, t("footerHint")),
			);
		}

		function ForgeRoot(props) {
			const ctx = props.ctx;
			const localeKey = React.useSyncExternalStore(
				React.useCallback(function (cb) {
					if (!ctx.locale || typeof ctx.locale.subscribe !== "function") return function () {};
					return ctx.locale.subscribe(cb);
				}, [ctx]),
				React.useCallback(function () {
					try {
						return ctx.locale && ctx.locale.getSnapshot ? ctx.locale.getSnapshot().active : activeLocale();
					} catch (e) {
						return activeLocale();
					}
				}, [ctx]),
				function () { return "en"; },
			);
			return React.createElement(ForgePanel, {
				key: "git-forge-" + String(localeKey || "en"),
				visible: props.visible,
				scope: props.scope,
			});
		}

		const inject = ["betterSidebar", "locale"];
		function apply(ctx) {
			ensureStyles();
			if (ctx.locale) {
				attachLocale(ctx.locale);
				ctx.effect(function () {
					const offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
					const offEn = ctx.locale.register(LOCALE_NS, "en", en);
					return function () {
						try { offZh(); } catch (e) {}
						try { offEn(); } catch (e) {}
					};
				}, "dsh-git-forge: dictionaries");
			}
			if (!ctx.betterSidebar) return;
			ctx.effect(function () {
				return ctx.betterSidebar.registerTab({
					id: TAB_ID,
					title: function () { return t("tabTitle"); },
					icon: function (size) { return icon(size); },
					order: 46,
					single: true,
					component: function (p) {
						return React.createElement(ForgeRoot, {
							ctx: ctx,
							visible: p.visible,
							scope: p.scope,
						});
					},
				});
			}, "dsh-git-forge: register tab");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
