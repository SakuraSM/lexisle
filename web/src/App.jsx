import { useEffect, useMemo, useRef, useState } from "react";
import PocketBase from "pocketbase";
import {
  BarChartIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckCircledIcon,
  Cross2Icon,
  FileTextIcon,
  GearIcon,
  LightningBoltIcon,
  PersonIcon,
  ReaderIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { todayKey } from "./data/seed.js";
import { isDue } from "./lib/learning.js";
import { loadCloudData, saveCloudData } from "./lib/pocketbaseSync.js";
import { useLexisleStore } from "./lib/store.js";
import { InsightsPage } from "./pages/InsightsPage.jsx";
import { LibraryPage } from "./pages/LibraryPage.jsx";
import { NotesPage } from "./pages/NotesPage.jsx";
import { ReaderPage } from "./pages/ReaderPage.jsx";
import { ReviewPage } from "./pages/ReviewPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { TodayPage } from "./pages/TodayPage.jsx";
import { VocabularyPage } from "./pages/VocabularyPage.jsx";

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "https://pocket.nings.top";
const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

const navItems = [
  { label: "今天", icon: CalendarIcon },
  { label: "图书馆", icon: ReaderIcon },
  { label: "复习", icon: ReloadIcon },
  { label: "词汇本", icon: BookmarkIcon, startsSection: true },
  { label: "笔记", icon: FileTextIcon },
  { label: "学习报告", icon: BarChartIcon },
  { label: "设置", icon: GearIcon },
];

function getAccount(record) {
  if (!record) return null;
  return { id: record.id, email: record.email || "", name: record.name || record.email?.split("@")[0] || "学习者" };
}

function getAuthMessage(error, mode) {
  if (!navigator.onLine) return "网络未连接，请恢复网络后重试。";
  if (error?.status === 404) return "PocketBase 中尚未配置 users 认证集合。";
  if (error?.status === 400) return mode === "register" ? "注册失败，请检查邮箱是否已存在，且密码不少于 8 位。" : "邮箱或密码不正确，请重新输入。";
  return "暂时无法连接登录服务，请稍后重试。";
}

function routeFromHash() {
  const value = decodeURIComponent(window.location.hash.slice(1));
  return navItems.some((item) => item.label === value) ? value : "今天";
}

function Topbar({ state, user, onAccount }) {
  const plan = state.plans[todayKey];
  const days = [["日", "9", true], ["一", "10", true], ["二", "11", true], ["三", "12", true], ["四", "13", false], ["五", "14", false], ["六", "15", false]];
  return (
    <header className="topbar">
      <div className="date-block"><strong>2026 年 8 月 12 日</strong><span>星期三</span></div>
      <div className="week-strip" aria-label="本周学习情况">{days.map(([day, date, learned]) => <div key={date} className={date === "12" ? "is-today" : ""}><span>{day}</span><strong>{date}</strong><i className={learned ? "is-learned" : ""} /></div>)}</div>
      <div className="today-plan"><span>今日计划</span><strong>阅读 <b>{plan.readingDone}/{plan.readingTarget}</b> · 学习 <b>{plan.wordDone}/{plan.wordTarget}</b> · 复习 <em>{plan.reviewDone}/{plan.reviewTarget}</em></strong></div>
      <button className="user-button" type="button" onClick={onAccount}><PersonIcon /><span>{user?.name || "登录"}</span></button>
    </header>
  );
}

function Sidebar({ active, navigate, state }) {
  return (
    <aside className="sidebar">
      <div className="brand-block"><strong>Lexisle</strong><span>阅读 · 词汇 · 记忆地图</span></div>
      <nav aria-label="主导航">{navItems.map(({ label, icon: Icon, startsSection }) => <button key={label} type="button" className={`${active === label ? "is-active" : ""} ${startsSection ? "starts-section" : ""}`} onClick={() => navigate(label)}><Icon /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="streak-card"><div><LightningBoltIcon /><strong>{state.streak}</strong><span>天连胜</span></div><p>继续保持，真棒！</p><progress value="72" max="100">72%</progress></div><button className="milestone-button" type="button" onClick={() => navigate("学习报告")}><CheckCircledIcon /><span>学习报告</span><BarChartIcon /></button></div>
    </aside>
  );
}

function MobileChrome({ active, navigate, user, onAccount, dueCount }) {
  const mobileItems = navItems.slice(0, 5);
  const [moreOpen, setMoreOpen] = useState(false);
  return <><header className="mobile-app-header"><strong>Lexisle</strong><span>{active}</span><button type="button" onClick={onAccount}><PersonIcon />{user?.name || "登录"}</button></header><nav className="mobile-bottom-nav" aria-label="移动端导航">{mobileItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "is-active" : ""} type="button" onClick={() => navigate(label)}><Icon />{label}{label === "复习" && dueCount ? <i>{dueCount}</i> : null}</button>)}<button className={["学习报告", "设置"].includes(active) ? "is-active" : ""} type="button" onClick={() => setMoreOpen((value) => !value)}><GearIcon />更多</button></nav>{moreOpen ? <div className="mobile-more-menu"><button type="button" onClick={() => { navigate("学习报告"); setMoreOpen(false); }}><BarChartIcon />学习报告</button><button type="button" onClick={() => { navigate("设置"); setMoreOpen(false); }}><GearIcon />设置</button></div> : null}</>;
}

export function App() {
  const { state, actions } = useLexisleStore();
  const [activeNav, setActiveNav] = useState(routeFromHash);
  const [readerId, setReaderId] = useState("");
  const [loginOpen, setLoginOpen] = useState(() => new URLSearchParams(window.location.search).has("qa-auth"));
  const [user, setUser] = useState(() => getAccount(pb.authStore.record));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState(user ? "等待同步" : "本地保存");
  const syncTimer = useRef(null);
  const reader = state.articles.find((article) => article.id === readerId);
  const dueCount = useMemo(() => state.vocabulary.filter((item) => isDue(item)).length, [state.vocabulary]);

  const notify = (message) => setNotice(message);
  const navigate = (label) => {
    setReaderId("");
    setActiveNav(label);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(label)}`);
  };
  const openArticle = (id) => { setReaderId(id); setActiveNav("图书馆"); };

  useEffect(() => {
    const onHash = () => setActiveNav(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(getAccount(record)), true);
    if (pb.authStore.isValid) pb.collection("users").authRefresh().catch(() => pb.authStore.clear());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) { setSyncStatus("本地保存"); return; }
    let active = true;
    setSyncStatus("正在读取云端数据…");
    loadCloudData(pb, user.id).then((cloud) => {
      if (!active) return;
      if (cloud.articlesProgress?.length) {
        const progressMap = new Map(cloud.articlesProgress.map((item) => [item.article_url, item]));
        cloud.articles = (cloud.articles || state.articles).map((article) => { const progress = progressMap.get(article.url); return progress ? { ...article, progress: progress.progress, saved: progress.saved_for_later } : article; });
        delete cloud.articlesProgress;
      }
      if (Object.keys(cloud).length) actions.replaceFromCloud(cloud);
      setSyncStatus("已连接 PocketBase");
    }).catch(() => active && setSyncStatus("云端集合未配置，本地保存中"));
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      setSyncStatus("正在同步…");
      saveCloudData(pb, user.id, state).then(() => setSyncStatus("刚刚已同步")).catch(() => setSyncStatus("云端集合未配置，本地已保存"));
    }, 1800);
    return () => window.clearTimeout(syncTimer.current);
  }, [user?.id, state]);

  useEffect(() => {
    if (!state.settings.notifications || Notification.permission !== "granted") return undefined;
    const checkReminder = () => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const key = `lexisle:notified:${todayKey}`;
      if (current >= state.settings.reminderTime && dueCount && !localStorage.getItem(key)) {
        new Notification("Lexisle 复习时间", { body: `${dueCount} 个单词正在等待复习。` });
        localStorage.setItem(key, "true");
      }
    };
    checkReminder();
    const interval = window.setInterval(checkReminder, 60000);
    return () => window.clearInterval(interval);
  }, [state.settings.notifications, state.settings.reminderTime, dueCount]);

  const syncNow = async () => {
    if (!user) return;
    setSyncStatus("正在同步…");
    try { await saveCloudData(pb, user.id, state); setSyncStatus("刚刚已同步"); notify("学习数据已同步到 PocketBase"); }
    catch { setSyncStatus("云端集合未配置，本地已保存"); notify("云端集合暂不可用，数据已安全保存在本机"); }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (!email.trim() || !password) { setAuthError("请输入邮箱和密码。"); return; }
    if (authMode === "register" && password !== passwordConfirm) { setAuthError("两次输入的密码不一致。"); return; }
    setAuthBusy(true);
    try {
      if (authMode === "register") await pb.collection("users").create({ email: email.trim(), password, passwordConfirm, name: email.trim().split("@")[0], timezone: "Asia/Shanghai", daily_goal: state.settings.dailyGoal });
      await pb.collection("users").authWithPassword(email.trim(), password);
      setPassword(""); setPasswordConfirm(""); setLoginOpen(false); notify(authMode === "register" ? "账号已创建，正在合并学习记录" : "登录成功，正在同步学习记录");
    } catch (error) { setAuthError(getAuthMessage(error, authMode)); }
    finally { setAuthBusy(false); }
  };

  const signOut = () => { pb.authStore.clear(); setLoginOpen(false); setSyncStatus("本地保存"); notify("已退出账号，本地数据仍会保留"); };

  let content;
  if (reader) content = <ReaderPage article={reader} state={state} actions={actions} close={() => setReaderId("")} notify={notify} />;
  else if (activeNav === "图书馆") content = <LibraryPage state={state} actions={actions} openArticle={openArticle} notify={notify} />;
  else if (activeNav === "复习") content = <ReviewPage state={state} actions={actions} notify={notify} />;
  else if (activeNav === "词汇本") content = <VocabularyPage state={state} actions={actions} />;
  else if (activeNav === "笔记") content = <NotesPage state={state} actions={actions} notify={notify} />;
  else if (activeNav === "学习报告") content = <InsightsPage state={state} />;
  else if (activeNav === "设置") content = <SettingsPage state={state} actions={actions} user={user} openAccount={() => setLoginOpen(true)} syncStatus={syncStatus} syncNow={syncNow} notify={notify} />;
  else content = <TodayPage state={state} actions={actions} navigate={navigate} openArticle={openArticle} notify={notify} />;

  return (
    <div className="workspace product-workspace">
      <Sidebar active={activeNav} navigate={navigate} state={state} />
      <Topbar state={state} user={user} onAccount={() => setLoginOpen(true)} />
      <MobileChrome active={activeNav} navigate={navigate} user={user} onAccount={() => setLoginOpen(true)} dueCount={dueCount} />
      <main className="product-main">{content}</main>
      {notice ? <button className="toast" type="button" onClick={() => setNotice("")} aria-live="polite">{notice}<Cross2Icon /></button> : null}
      {loginOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={() => setLoginOpen(false)}><section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setLoginOpen(false)} aria-label="关闭"><Cross2Icon /></button><div className="modal-icon"><PersonIcon /></div><h2 id="login-title">{user ? "账号与同步" : "登录 Lexisle"}</h2><p>{user ? "你的计划、阅读进度和词汇复习记录可同步到 PocketBase。" : "使用邮箱继续，在不同设备之间保存学习记录。"}</p>{user ? <div className="account-panel"><div className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div><i><span />{syncStatus}</i><button className="modal-primary" type="button" onClick={syncNow}>立即同步</button><button className="modal-secondary" type="button" onClick={signOut}>退出登录</button></div> : <><div className="auth-tabs" role="tablist"><button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>登录</button><button type="button" className={authMode === "register" ? "is-active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>注册</button></div><form className="auth-form" onSubmit={submitAuth}><label><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label><label><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label>{authMode === "register" ? <label><span>确认密码</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></label> : null}{authError ? <div className="auth-error" role="alert">{authError}</div> : null}<button className="modal-primary" type="submit" disabled={authBusy}>{authBusy ? "正在连接…" : authMode === "register" ? "创建账号并开始学习" : "登录并继续学习"}</button></form><div className="service-status"><span />PocketBase · pocket.nings.top</div></>}</section></div> : null}
    </div>
  );
}
