import { useEffect, useRef } from "react";
import { Cross2Icon, PersonIcon } from "@radix-ui/react-icons";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function AccountModal({
  authBusy,
  authError,
  authMode,
  email,
  onAuthModeChange,
  onClose,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSignOut,
  onSubmit,
  onSync,
  password,
  passwordConfirm,
  returnFocusElement,
  syncStatus,
  user,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusElement?.focus?.();
    };
  }, [onClose, returnFocusElement]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeRef} className="modal-close" type="button" onClick={onClose} aria-label="关闭账号弹窗"><Cross2Icon /></button>
        <div className="modal-icon" aria-hidden="true"><PersonIcon /></div>
        <h2 id="login-title">{user ? "账号与同步" : "登录 Lexisle"}</h2>
        <p>{user ? "你的计划、阅读进度和词汇复习记录可同步到 PocketBase。" : "使用邮箱继续，在不同设备之间保存学习记录。"}</p>
        {user ? (
          <div className="account-panel">
            <div className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div><strong>{user.name}</strong><span>{user.email}</span></div>
            <i className={`sync-indicator is-${syncStatus.kind}`}><span />{syncStatus.label}</i>
            <button className="modal-primary" type="button" onClick={onSync}>立即同步</button>
            <button className="modal-secondary" type="button" onClick={onSignOut}>退出登录</button>
          </div>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="登录方式">
              <button id="auth-tab-login" type="button" role="tab" aria-selected={authMode === "login"} aria-controls="auth-panel" tabIndex={authMode === "login" ? 0 : -1} className={authMode === "login" ? "is-active" : ""} onClick={() => onAuthModeChange("login")}>登录</button>
              <button id="auth-tab-register" type="button" role="tab" aria-selected={authMode === "register"} aria-controls="auth-panel" tabIndex={authMode === "register" ? 0 : -1} className={authMode === "register" ? "is-active" : ""} onClick={() => onAuthModeChange("register")}>注册</button>
            </div>
            <form id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${authMode}`} className="auth-form" onSubmit={onSubmit}>
              <label htmlFor="auth-email"><span>邮箱</span></label>
              <input id="auth-email" name="email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={Boolean(authError)} aria-describedby={authError ? "auth-error" : undefined} />
              <label htmlFor="auth-password"><span>密码</span></label>
              <input id="auth-password" name="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="至少 8 位" autoComplete={authMode === "register" ? "new-password" : "current-password"} aria-invalid={Boolean(authError)} aria-describedby={authError ? "auth-error" : undefined} />
              {authMode === "register" ? <><label htmlFor="auth-password-confirm"><span>确认密码</span></label><input id="auth-password-confirm" name="passwordConfirm" type="password" value={passwordConfirm} onChange={(event) => onPasswordConfirmChange(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" aria-invalid={Boolean(authError)} aria-describedby={authError ? "auth-error" : undefined} /></> : null}
              {authError ? <div id="auth-error" className="auth-error" role="alert">{authError}</div> : null}
              <button className="modal-primary" type="submit" disabled={authBusy}>{authBusy ? "正在连接…" : authMode === "register" ? "创建账号并开始学习" : "登录并继续学习"}</button>
            </form>
            <div className="service-status"><span />PocketBase · pocket.nings.top</div>
          </>
        )}
      </section>
    </div>
  );
}
