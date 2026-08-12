import { useEffect, useState } from "react";
import PocketBase from "pocketbase";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckCircledIcon,
  Cross2Icon,
  DotsHorizontalIcon,
  FileTextIcon,
  GearIcon,
  InfoCircledIcon,
  LightningBoltIcon,
  PersonIcon,
  ReaderIcon,
  ReloadIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "https://pocket.nings.top";
const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

function getAccount(record) {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email || "",
    name: record.name || record.email?.split("@")[0] || "学习者",
  };
}

function getAuthMessage(error, mode) {
  if (!navigator.onLine) return "网络未连接，请恢复网络后重试。";
  if (error?.status === 404) return "PocketBase 中尚未配置 users 认证集合。";
  if (error?.status === 400) {
    return mode === "register"
      ? "注册失败，请检查邮箱是否已存在，且密码不少于 8 位。"
      : "邮箱或密码不正确，请重新输入。";
  }
  return "暂时无法连接登录服务，请稍后重试。";
}

const words = {
  growing: {
    word: "growing",
    phonetic: "/ˈɡroʊɪŋ/",
    part: "adj.",
    meaning: "增长的；日益增加的",
    context: "A growing body of research suggests another hero of the night: deep sleep.",
    status: "新词",
    tone: "new",
  },
  cortex: {
    word: "cortex",
    phonetic: "/ˈkɔːrteks/",
    part: "n.",
    meaning: "大脑皮层；皮质层",
    context: "During deep sleep, the cortex becomes less active.",
    status: "学习中",
    tone: "learning",
  },
  surge: {
    word: "surge",
    phonetic: "/sɜːrdʒ/",
    part: "n.",
    meaning: "激增；猛增",
    context: "A surge of cerebrospinal fluid flushes out waste proteins.",
    status: "新词",
    tone: "new",
  },
  implications: {
    word: "implications",
    phonetic: "/ˌɪmplɪˈkeɪʃənz/",
    part: "n.",
    meaning: "含义；可能的影响",
    context: "The implications for health are enormous.",
    status: "学习中",
    tone: "learning",
  },
};

const memoryTrail = [
  { key: "surge", number: 1, due: "明天" },
  { key: "cortex", number: 2, due: "2 天后" },
  { key: "implications", number: 3, due: "3 天后" },
  { key: "decline", number: 4, due: "8 月 18 日", status: "待复习" },
];

const navItems = [
  { label: "今天", icon: CalendarIcon },
  { label: "图书馆", icon: ReaderIcon },
  { label: "复习", icon: ReloadIcon },
  { label: "词汇本", icon: BookmarkIcon },
  { label: "笔记", icon: FileTextIcon },
  { label: "设置", icon: GearIcon },
];

export function App() {
  const [activeWord, setActiveWord] = useState("cortex");
  const [activeNav, setActiveNav] = useState("今天");
  const [loginOpen, setLoginOpen] = useState(() => new URLSearchParams(window.location.search).has("qa-auth"));
  const [user, setUser] = useState(() => getAccount(pb.authStore.record));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [progress, setProgress] = useState(() => Number(window.localStorage.getItem("zhiyu-article-progress")) || 28);
  const [saved, setSaved] = useState(() => window.localStorage.getItem("zhiyu-saved-cortex") === "true");
  const [notice, setNotice] = useState("");
  const detail = words[activeWord] || words.cortex;

  useEffect(() => {
    window.localStorage.setItem("zhiyu-article-progress", String(progress));
  }, [progress]);

  useEffect(() => {
    window.localStorage.setItem("zhiyu-saved-cortex", String(saved));
  }, [saved]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(getAccount(record)), true);
    if (pb.authStore.isValid) {
      pb.collection("users").authRefresh().catch(() => pb.authStore.clear());
    }
    return unsubscribe;
  }, []);

  const chooseWord = (key) => {
    setActiveWord(key);
    setNotice(`${words[key].word} 的语境解释已展开`);
  };

  const continueReading = () => {
    const next = Math.min(100, progress + 8);
    setProgress(next);
    setNotice(`阅读进度已保存到 ${next}%`);
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("请输入邮箱和密码。");
      return;
    }
    if (authMode === "register" && password !== passwordConfirm) {
      setAuthError("两次输入的密码不一致。");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        await pb.collection("users").create({
          email: email.trim(),
          password,
          passwordConfirm,
        });
      }
      await pb.collection("users").authWithPassword(email.trim(), password);
      setPassword("");
      setPasswordConfirm("");
      setLoginOpen(false);
      setNotice(authMode === "register" ? "账号已创建，学习记录开始云端同步" : "登录成功，学习记录将同步到 PocketBase");
    } catch (error) {
      setAuthError(getAuthMessage(error, authMode));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = () => {
    pb.authStore.clear();
    setLoginOpen(false);
    setNotice("已安全退出账号");
  };

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand-block">
          <strong>知屿英语</strong>
          <span>阅读 · 词汇 · 记忆地图</span>
        </div>

        <nav aria-label="主导航">
          {navItems.map(({ label, icon: Icon }, index) => (
            <button
              key={label}
              type="button"
              className={`${activeNav === label ? "is-active" : ""} ${index === 3 ? "starts-section" : ""}`}
              onClick={() => {
                setActiveNav(label);
                setNotice(`${label}视图已选中`);
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div><LightningBoltIcon /><strong>15</strong><span>天连胜</span></div>
            <p>继续保持，真棒！</p>
            <progress value="72" max="100">72%</progress>
          </div>
          <button className="milestone-button" type="button" onClick={() => setNotice("本周里程碑：完成 5 天学习") }>
            <CheckCircledIcon />
            <span>里程碑</span>
            <ArrowRightIcon />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div className="date-block">
          <strong>2026 年 8 月 12 日</strong>
          <span>星期三</span>
        </div>
        <div className="week-strip" aria-label="2026年8月9日至15日学习情况">
          {[
            ["日", "9", true], ["一", "10", true], ["二", "11", true], ["三", "12", true],
            ["四", "13", false], ["五", "14", false], ["六", "15", false],
          ].map(([day, date, learned]) => (
            <div key={date} className={date === "12" ? "is-today" : ""}>
              <span>{day}</span>
              <strong>{date}</strong>
              <i className={learned ? "is-learned" : ""} />
            </div>
          ))}
        </div>
        <div className="today-plan">
          <span>今日计划</span>
          <strong>阅读 <b>1</b> 篇 · 学习 <b>5</b> 个词 · 复习 <em>8</em> 个</strong>
        </div>
        <button className="user-button" type="button" onClick={() => setLoginOpen(true)}>
          <PersonIcon />
          <span>{user?.name || "登录"}</span>
        </button>
      </header>

      <main className="reader-area">
        <article className="reader-card">
          <header className="article-header">
            <div>
              <span>睡眠科学特辑</span>
              <h1>Why Deep Sleep Matters More<br />Than You Think</h1>
              <p>New research shows that the deepest stage of sleep is when your brain clears waste, strengthens memories, and helps your body heal.</p>
            </div>
            <img src="/assets/deep-sleep-bedroom.png" alt="月光下安静的深蓝色卧室" />
          </header>

          <div className="article-body">
            <p>
              For years, sleep scientists believed that dreaming was the brain’s main nighttime job. But a{" "}
              <button className="inline-word status-new" type="button" onClick={() => chooseWord("growing")}>growing</button>{" "}
              body of research suggests another hero of the night: deep sleep.
            </p>
            <p>
              During this stage, slow brain waves sweep across the{" "}
              <button className="inline-word status-learning" type="button" onClick={() => chooseWord("cortex")}>cortex</button>, coordinating a remarkable cleanup operation.
            </p>

            <section className={`word-detail tone-${detail.tone}`} aria-live="polite">
              <button className="detail-sound" type="button" aria-label={`播放 ${detail.word} 发音`}><SpeakerLoudIcon /></button>
              <div className="detail-content">
                <div className="detail-title">
                  <h2>{detail.word}</h2>
                  <span>{detail.phonetic}</span>
                  <i>{detail.part}</i>
                  <strong>{detail.meaning}</strong>
                  <em className={`status-tag ${detail.tone}`}>{detail.status}</em>
                </div>
                <p>{detail.word === "cortex" ? "大脑最外层的区域，负责处理感觉、思考、记忆等高级功能。" : detail.meaning}</p>
                <small>例句：{detail.context}</small>
                <div className="detail-actions">
                  <button type="button" onClick={() => setSaved((value) => !value)}><BookmarkIcon />{saved ? "已加入词汇本" : "加入词汇本"}</button>
                  <button type="button"><SpeakerLoudIcon />发音</button>
                </div>
              </div>
              <button className="more-button" type="button" aria-label="更多词汇操作"><DotsHorizontalIcon /></button>
            </section>

            <p>
              A recent study from the University of Rochester found that deep sleep triggers a{" "}
              <button className="inline-word status-new" type="button" onClick={() => chooseWord("surge")}>surge</button>{" "}
              of cerebrospinal fluid, which flushes out waste proteins that accumulate during the day. When this system falters, the risk of cognitive decline may rise.
            </p>
            <p>
              The{" "}<button className="inline-word status-new" type="button" onClick={() => chooseWord("implications")}>implications</button>{" "}
              are clear: protecting deep sleep isn’t a luxury. It’s maintenance for your mind.
            </p>
          </div>

          <footer className="article-footer">
            <span>文章进度：{progress}%</span>
            <progress value={progress} max="100">{progress}%</progress>
            <button type="button" onClick={continueReading}>继续阅读<ArrowRightIcon /></button>
            <button className="later-button" type="button" onClick={() => setNotice("文章已加入稍后阅读")}><BookmarkIcon />稍后读</button>
          </footer>
        </article>
      </main>

      <aside className="memory-panel">
        <div className="panel-heading">
          <div><strong>记忆轨迹</strong><span>关联你的学习路径</span></div>
          <InfoCircledIcon />
        </div>
        <ol className="memory-list">
          {memoryTrail.map((item) => {
            const known = words[item.key];
            const selected = activeWord === item.key;
            const status = item.status || known?.status;
            const tone = item.status ? "review" : known?.tone;
            return (
              <li key={item.key} className={`${selected ? "is-selected" : ""} tone-${tone}`}>
                <button type="button" className="memory-index" onClick={() => known && chooseWord(item.key)}>{item.number}</button>
                <div>
                  <div className="memory-word"><strong>{known?.word || "decline"}</strong><span className={`status-tag ${tone}`}>{status}</span></div>
                  <p>{known?.meaning || "下降；衰退"}</p>
                  <small>{known?.context || "Cognitive decline can affect daily life."}</small>
                  <em>下次复习：{item.due}</em>
                </div>
              </li>
            );
          })}
        </ol>
        <button className="vocabulary-link" type="button" onClick={() => setActiveNav("词汇本")}>查看全部词汇本<ArrowRightIcon /></button>
        <div className="sleep-tip"><InfoCircledIcon /><p>小贴士：睡前 90 分钟远离屏幕，更容易进入深度睡眠。</p></div>
      </aside>

      {notice && <button className="toast" type="button" onClick={() => setNotice("")} aria-live="polite">{notice}<Cross2Icon /></button>}

      {loginOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setLoginOpen(false)}>
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setLoginOpen(false)} aria-label="关闭"><Cross2Icon /></button>
            <div className="modal-icon"><PersonIcon /></div>
            <h2 id="login-title">{user ? "账号已登录" : "登录知屿英语"}</h2>
            <p>{user ? "你的每日计划、文章进度和词汇复习记录已连接 PocketBase。" : "使用邮箱继续，跨设备保存每日计划与间隔复习记录。"}</p>
            {user ? (
              <div className="account-panel">
                <div className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
                <div><strong>{user.name}</strong><span>{user.email}</span></div>
                <i><span />云端同步已开启</i>
                <button className="modal-primary" type="button" onClick={() => setLoginOpen(false)}>继续阅读</button>
                <button className="modal-secondary" type="button" onClick={signOut}>退出登录</button>
              </div>
            ) : (
              <>
                <div className="auth-tabs" role="tablist" aria-label="账号操作">
                  <button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "is-active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>登录</button>
                  <button type="button" role="tab" aria-selected={authMode === "register"} className={authMode === "register" ? "is-active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>注册</button>
                </div>
                <form className="auth-form" onSubmit={submitAuth}>
                  <label><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
                  <label><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label>
                  {authMode === "register" && <label><span>确认密码</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></label>}
                  {authError && <div className="auth-error" role="alert">{authError}</div>}
                  <button className="modal-primary" type="submit" disabled={authBusy}>{authBusy ? "正在连接…" : authMode === "register" ? "创建账号并开始学习" : "登录并继续学习"}</button>
                </form>
                <div className="service-status"><span />PocketBase 服务在线 · pocket.nings.top</div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
