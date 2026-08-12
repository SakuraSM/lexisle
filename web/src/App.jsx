import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AccountModal } from "./components/AccountModal.jsx";
import { formatChineseDate, getLocalDateKey, getWeekDateKeys, millisecondsUntilNextLocalDay } from "./lib/date.js";
import { isDue } from "./lib/learning.js";
import { loadCloudData, saveCloudData } from "./lib/pocketbaseSync.js";
import { calculateStreak, hasPlanActivity, mergeCloudState } from "./lib/stateModel.js";
import { useLexisleStore } from "./lib/store.js";

const TodayPage = lazy(() => import("./pages/TodayPage.jsx").then((module) => ({ default: module.TodayPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage.jsx").then((module) => ({ default: module.LibraryPage })));
const ReaderPage = lazy(() => import("./pages/ReaderPage.jsx").then((module) => ({ default: module.ReaderPage })));
const ReviewPage = lazy(() => import("./pages/ReviewPage.jsx").then((module) => ({ default: module.ReviewPage })));
const VocabularyPage = lazy(() => import("./pages/VocabularyPage.jsx").then((module) => ({ default: module.VocabularyPage })));
const NotesPage = lazy(() => import("./pages/NotesPage.jsx").then((module) => ({ default: module.NotesPage })));
const InsightsPage = lazy(() => import("./pages/InsightsPage.jsx").then((module) => ({ default: module.InsightsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx").then((module) => ({ default: module.SettingsPage })));

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "https://pocket.nings.top";
const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

const LOCAL_SYNC_STATUS = { kind: "local", label: "本地保存" };

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

function getSyncStatus(result) {
  if (result.status === "unavailable") return { kind: "unavailable", label: "同步服务未配置，本地保存中" };
  if (result.status === "partial") return { kind: "partial", label: `${result.failedCollections.length} 个集合同步失败` };
  return { kind: "ok", label: "刚刚已同步" };
}

function Topbar({ state, user, onAccount, dateKey }) {
  const plan = state.plans[dateKey] || { readingDone: 0, readingTarget: 1, wordDone: 0, wordTarget: state.settings.dailyGoal, reviewDone: 0, reviewTarget: 8 };
  const dateLabel = formatChineseDate(dateKey);
  const days = getWeekDateKeys(dateKey);
  const dayNames = ["一", "二", "三", "四", "五", "六", "日"];
  return (
    <header className="topbar">
      <div className="date-block"><strong>{dateLabel.date}</strong><span>{dateLabel.weekday}</span></div>
      <div className="week-strip" aria-label="本周学习情况">{days.map((date, index) => <div key={date} className={date === dateKey ? "is-today" : ""}><span>{dayNames[index]}</span><strong>{Number(date.slice(-2))}</strong><i className={hasPlanActivity(state.plans[date]) ? "is-learned" : ""} /></div>)}</div>
      <div className="today-plan"><span>今日计划</span><strong>阅读 <b>{plan.readingDone}/{plan.readingTarget}</b> · 学习 <b>{plan.wordDone}/{plan.wordTarget}</b> · 复习 <em>{plan.reviewDone}/{plan.reviewTarget}</em></strong></div>
      <button className="user-button" type="button" onClick={onAccount}><PersonIcon /><span>{user?.name || "登录"}</span></button>
    </header>
  );
}

function Sidebar({ active, navigate, streak }) {
  return (
    <aside className="sidebar">
      <div className="brand-block"><strong>Lexisle</strong><span>阅读 · 词汇 · 记忆地图</span></div>
      <nav aria-label="主导航">{navItems.map(({ label, icon: Icon, startsSection }) => <button key={label} type="button" className={`${active === label ? "is-active" : ""} ${startsSection ? "starts-section" : ""}`} onClick={() => navigate(label)}><Icon /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="streak-card"><div><LightningBoltIcon /><strong>{streak}</strong><span>天连胜</span></div><p>{streak ? "继续保持，真棒！" : "今天开始新的连续学习"}</p><progress value={Math.min(7, streak)} max="7">{streak}/7</progress></div><button className="milestone-button" type="button" onClick={() => navigate("学习报告")}><CheckCircledIcon /><span>学习报告</span><BarChartIcon /></button></div>
    </aside>
  );
}

function MobileChrome({ active, navigate, user, onAccount, dueCount }) {
  const mobileItems = navItems.slice(0, 5);
  const [moreOpen, setMoreOpen] = useState(false);
  return <><header className="mobile-app-header"><strong>Lexisle</strong><span>{active}</span><button type="button" onClick={onAccount}><PersonIcon />{user?.name || "登录"}</button></header><nav className="mobile-bottom-nav" aria-label="移动端导航">{mobileItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "is-active" : ""} type="button" onClick={() => navigate(label)}><Icon />{label}{label === "复习" && dueCount ? <i>{dueCount}</i> : null}</button>)}<button className={["学习报告", "设置"].includes(active) ? "is-active" : ""} type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><GearIcon />更多</button></nav>{moreOpen ? <div className="mobile-more-menu"><button type="button" onClick={() => { navigate("学习报告"); setMoreOpen(false); }}><BarChartIcon />学习报告</button><button type="button" onClick={() => { navigate("设置"); setMoreOpen(false); }}><GearIcon />设置</button></div> : null}</>;
}

export function App() {
  const { state, actions } = useLexisleStore();
  const [dateKey, setDateKey] = useState(getLocalDateKey);
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
  const [syncStatus, setSyncStatus] = useState(user ? { kind: "waiting", label: "等待同步" } : LOCAL_SYNC_STATUS);
  const mainRef = useRef(null);
  const returnFocusRef = useRef(null);
  const stateRef = useRef(state);
  const syncTimer = useRef(null);
  const syncReadyUser = useRef("");
  stateRef.current = state;

  const reader = state.articles.find((article) => article.id === readerId);
  const dueCount = useMemo(() => state.vocabulary.filter((item) => isDue(item)).length, [state.vocabulary]);
  const streak = useMemo(() => calculateStreak(state.plans, dateKey), [state.plans, dateKey]);
  const notify = useCallback((message) => setNotice(message), []);
  const closeAccount = useCallback(() => setLoginOpen(false), []);
  const openAccount = useCallback(() => {
    returnFocusRef.current = document.activeElement;
    setLoginOpen(true);
  }, []);

  const resetMainScroll = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const navigate = useCallback((label) => {
    setReaderId("");
    setActiveNav(label);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(label)}`);
    resetMainScroll();
  }, [resetMainScroll]);

  const openArticle = useCallback((id) => {
    setReaderId(id);
    setActiveNav("图书馆");
    resetMainScroll();
  }, [resetMainScroll]);

  const performSync = useCallback(async (showSummary = false) => {
    if (!user) return { status: "unavailable", failedCollections: [] };
    setSyncStatus({ kind: "syncing", label: "正在合并本地与云端数据…" });
    const loaded = await loadCloudData(pb, user.id);
    if (loaded.status === "unavailable") {
      setSyncStatus(getSyncStatus(loaded));
      if (showSummary) notify("PocketBase 学习集合尚未配置，数据继续安全保存在本机");
      return loaded;
    }
    const merged = mergeCloudState(stateRef.current, loaded.data);
    actions.replaceState(merged.state);
    stateRef.current = merged.state;
    const saved = await saveCloudData(pb, user.id, merged.state);
    const finalResult = saved.status === "ok" && loaded.status !== "ok" ? loaded : saved;
    setSyncStatus(getSyncStatus(finalResult));
    if (showSummary) {
      notify(`同步完成：云端合并 ${merged.summary.downloaded} 项，本地保留 ${merged.summary.retained} 项，冲突 ${merged.summary.conflicts} 项`);
    }
    return finalResult;
  }, [actions, notify, user]);

  useEffect(() => {
    const onHash = () => { setActiveNav(routeFromHash()); resetMainScroll(); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [resetMainScroll]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(getAccount(record)), true);
    if (pb.authStore.isValid) pb.collection("users").authRefresh().catch(() => pb.authStore.clear());
    return unsubscribe;
  }, []);

  useEffect(() => {
    let midnightTimer;
    const refreshDate = () => {
      const nextDate = getLocalDateKey();
      setDateKey(nextDate);
      actions.ensureToday(nextDate);
    };
    const scheduleMidnight = () => {
      window.clearTimeout(midnightTimer);
      midnightTimer = window.setTimeout(() => { refreshDate(); scheduleMidnight(); }, millisecondsUntilNextLocalDay());
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refreshDate(); };
    refreshDate();
    scheduleMidnight();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearTimeout(midnightTimer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [actions]);

  useEffect(() => {
    if (!user) {
      syncReadyUser.current = "";
      setSyncStatus(LOCAL_SYNC_STATUS);
      return undefined;
    }
    let cancelled = false;
    syncReadyUser.current = "";
    performSync(true).catch(() => {
      if (!cancelled) setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" });
    }).finally(() => {
      if (!cancelled) syncReadyUser.current = user.id;
    });
    return () => { cancelled = true; };
  }, [performSync, user]);

  useEffect(() => {
    if (!user || syncReadyUser.current !== user.id) return undefined;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      setSyncStatus({ kind: "syncing", label: "正在同步…" });
      try {
        const result = await saveCloudData(pb, user.id, state);
        setSyncStatus(getSyncStatus(result));
      } catch {
        setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" });
      }
    }, 1800);
    return () => window.clearTimeout(syncTimer.current);
  }, [user, state]);

  useEffect(() => {
    if (!state.settings.notifications || Notification.permission !== "granted") return undefined;
    const checkReminder = () => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const key = `lexisle:notified:${getLocalDateKey(now)}`;
      if (current >= state.settings.reminderTime && dueCount && !localStorage.getItem(key)) {
        new Notification("Lexisle 复习时间", { body: `${dueCount} 个单词正在等待复习。` });
        localStorage.setItem(key, "true");
      }
    };
    checkReminder();
    const interval = window.setInterval(checkReminder, 60000);
    return () => window.clearInterval(interval);
  }, [state.settings.notifications, state.settings.reminderTime, dueCount]);

  const syncNow = useCallback(async () => {
    try { await performSync(true); }
    catch { setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" }); notify("同步失败，本地数据未受影响，可稍后重试"); }
  }, [notify, performSync]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (!email.trim() || !password) { setAuthError("请输入邮箱和密码。"); return; }
    if (authMode === "register" && password !== passwordConfirm) { setAuthError("两次输入的密码不一致。"); return; }
    setAuthBusy(true);
    try {
      if (authMode === "register") await pb.collection("users").create({ email: email.trim(), password, passwordConfirm, name: email.trim().split("@")[0], timezone: "Asia/Shanghai", daily_goal: state.settings.dailyGoal });
      await pb.collection("users").authWithPassword(email.trim(), password);
      setPassword("");
      setPasswordConfirm("");
      closeAccount();
      notify(authMode === "register" ? "账号已创建，正在合并本地与云端记录" : "登录成功，正在合并本地与云端记录");
    } catch (error) {
      setAuthError(getAuthMessage(error, authMode));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = () => {
    pb.authStore.clear();
    closeAccount();
    setSyncStatus(LOCAL_SYNC_STATUS);
    notify("已退出账号，本地数据仍会保留");
  };

  let content;
  if (reader) content = <ReaderPage article={reader} state={state} actions={actions} close={() => setReaderId("")} navigate={navigate} notify={notify} />;
  else if (activeNav === "图书馆") content = <LibraryPage state={state} actions={actions} openArticle={openArticle} navigate={navigate} notify={notify} />;
  else if (activeNav === "复习") content = <ReviewPage state={state} actions={actions} notify={notify} />;
  else if (activeNav === "词汇本") content = <VocabularyPage state={state} actions={actions} />;
  else if (activeNav === "笔记") content = <NotesPage state={state} actions={actions} notify={notify} />;
  else if (activeNav === "学习报告") content = <InsightsPage state={state} />;
  else if (activeNav === "设置") content = <SettingsPage state={state} actions={actions} user={user} openAccount={openAccount} syncStatus={syncStatus} syncNow={syncNow} notify={notify} />;
  else content = <TodayPage state={state} actions={actions} navigate={navigate} openArticle={openArticle} notify={notify} />;

  return (
    <div className="workspace product-workspace">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar active={activeNav} navigate={navigate} streak={streak} />
      <Topbar state={state} user={user} onAccount={openAccount} dateKey={dateKey} />
      <MobileChrome active={activeNav} navigate={navigate} user={user} onAccount={openAccount} dueCount={dueCount} />
      <main ref={mainRef} id="main-content" className="product-main" tabIndex="-1"><Suspense fallback={<div className="page-loading" role="status">正在打开页面…</div>}>{content}</Suspense></main>
      {notice ? <button className="toast" type="button" onClick={() => setNotice("")} aria-live="polite">{notice}<Cross2Icon /></button> : null}
      {loginOpen ? <AccountModal authBusy={authBusy} authError={authError} authMode={authMode} email={email} onAuthModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }} onClose={closeAccount} onEmailChange={setEmail} onPasswordChange={setPassword} onPasswordConfirmChange={setPasswordConfirm} onSignOut={signOut} onSubmit={submitAuth} onSync={syncNow} password={password} passwordConfirm={passwordConfirm} returnFocusElement={returnFocusRef.current} syncStatus={syncStatus} user={user} /> : null}
    </div>
  );
}
