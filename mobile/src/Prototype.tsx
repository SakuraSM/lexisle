import { useEffect, useState } from "react";
import PocketBase, { type RecordModel } from "pocketbase";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircledIcon,
  HeartIcon,
  LightningBoltIcon,
  PersonIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";
import { BottomSheet, KeyboardInput, MobileScroll } from "./mobile";

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "https://pocket.nings.top";
const pb = new PocketBase(pocketBaseUrl);
pb.autoCancellation(false);

type Account = {
  id: string;
  email: string;
  name: string;
};

function getAccount(record: RecordModel | null): Account | null {
  if (!record) return null;
  const email = typeof record.email === "string" ? record.email : "";
  const name = typeof record.name === "string" && record.name ? record.name : email.split("@")[0] || "学习者";
  return { id: record.id, email, name };
}

function getAuthMessage(error: unknown, mode: "login" | "register") {
  if (!navigator.onLine) return "网络未连接，请恢复网络后重试。";
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  if (status === 404) return "PocketBase 中尚未配置 users 认证集合。";
  if (status === 400) {
    return mode === "register"
      ? "注册失败，请检查邮箱是否已存在，且密码不少于 8 位。"
      : "邮箱或密码不正确，请重新输入。";
  }
  return "暂时无法连接登录服务，请稍后重试。";
}

const answers = [
  "快速移动；迅速行动",
  "适应；改变以适合环境",
  "恢复力；在困难后仍能恢复并继续",
  "危险；可能造成伤害的事物",
];

type LessonState = {
  progress: number;
  streak: number;
  saved: boolean;
};

const initialState: LessonState = { progress: 1, streak: 12, saved: false };

export default function Prototype() {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [loginOpen, setLoginOpen] = useState(() => new URLSearchParams(window.location.search).has("qa-auth"));
  const [user, setUser] = useState<Account | null>(() => getAccount(pb.authStore.record));
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [lesson, setLesson] = useState<LessonState>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("zhiyu-mobile-lesson") || "null") || initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("zhiyu-mobile-lesson", JSON.stringify(lesson));
  }, [lesson]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(getAccount(record)), true);
    if (pb.authStore.isValid) {
      pb.collection("users").authRefresh().catch(() => pb.authStore.clear());
    }
    return unsubscribe;
  }, []);

  const correct = selected === 2;

  const handlePrimary = () => {
    if (!checked) {
      if (selected === null) return;
      setChecked(true);
      if (selected === 2) setLesson((value) => ({ ...value, saved: true }));
      return;
    }

    setLesson((value) => ({ ...value, progress: Math.min(5, value.progress + 1) }));
    setSelected(null);
    setChecked(false);
  };

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
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
    } catch (error) {
      setAuthError(getAuthMessage(error, authMode));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = () => {
    pb.authStore.clear();
    setLoginOpen(false);
  };

  return (
    <>
      <MobileScroll className="app-screen">
        <main className="lesson-screen" aria-label="知屿英语移动端单词学习">
          <header className="lesson-header">
            <div className="brand-row">
              <strong className="brand">知屿英语</strong>
              <button className="account-button" type="button" onClick={() => setLoginOpen(true)}>
                <PersonIcon />
                <span>{user?.name || "登录"}</span>
              </button>
            </div>

            <div className="goal-row">
              <div>
                <span className="eyebrow">今日目标</span>
                <strong>{lesson.progress}/5</strong>
              </div>
              <div className="habit-stat streak-stat" aria-label={`${lesson.streak}天连续学习`}>
                <LightningBoltIcon />
                <strong>{lesson.streak}</strong>
                <span>连续天数</span>
              </div>
              <div className="habit-stat">
                <HeartIcon />
                <strong>3</strong>
                <span>体力</span>
              </div>
            </div>

            <div className="progress-track" aria-label={`今日学习进度 ${lesson.progress}/5`}>
              {[1, 2, 3, 4, 5].map((step) => (
                <span key={step} className={step <= lesson.progress ? "is-complete" : ""}>{step}</span>
              ))}
            </div>
          </header>

          <section className="lesson-intro">
            <p className="kicker">第 {lesson.progress} 题 · 语境理解</p>
            <h1>根据上下文，选择单词的意思</h1>
            <p>选出最符合文中含义的选项。</p>
          </section>

          <article className="article-card">
            <div className="article-heading">
              <div>
                <span className="topic">城市与野生动物</span>
                <h2>How Wildlife Adapts<br />to Urban Life</h2>
              </div>
              <img src="/assets/urban-raccoon.png" alt="城市公园石墙上的浣熊" />
            </div>
            <p>
              As cities grow, wildlife shows a remarkable <mark>resilience</mark>. From raccoons navigating alleys to hawks nesting on skyscrapers, these animals adapt in ways that surprise us.
            </p>
          </article>

          <section className="question-block">
            <div className="word-row">
              <button className="sound-button" type="button" aria-label="播放 resilience 发音">
                <SpeakerLoudIcon />
              </button>
              <div>
                <div className="word-title">
                  <h3>resilience</h3>
                  <span>新词</span>
                </div>
                <p>在文中的意思是：</p>
              </div>
            </div>

            <div className="answers" role="radiogroup" aria-label="选择 resilience 的含义">
              {answers.map((answer, index) => {
                const isSelected = selected === index;
                const isRight = checked && index === 2;
                const isWrong = checked && isSelected && index !== 2;
                return (
                  <button
                    key={answer}
                    className={`answer ${isSelected ? "is-selected" : ""} ${isRight ? "is-right" : ""} ${isWrong ? "is-wrong" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={checked}
                    onClick={() => setSelected(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    <strong>{answer}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          {checked && (
            <section className={`feedback ${correct ? "is-correct" : "is-incorrect"}`} aria-live="polite">
              <CheckCircledIcon />
              <div>
                <h3>{correct ? "正确！" : "再想一下"}</h3>
                <p>
                  <strong>resilience</strong> 指“从困难中恢复并继续”的能力。文中指城市野生动物面对挑战时展现出的恢复力。
                </p>
              </div>
            </section>
          )}

          <button className="primary-action" type="button" disabled={selected === null} onClick={handlePrimary}>
            <span>{checked ? "继续" : "检查答案"}</span>
            <ArrowRightIcon />
          </button>

          <div className="review-note">
            <BookmarkIcon />
            <span>{lesson.saved ? "已保存到词汇本，并安排明天复习" : "答对后自动保存，并按记忆曲线安排复习"}</span>
          </div>
        </main>
      </MobileScroll>

      <BottomSheet
        open={loginOpen}
        onOpenChange={setLoginOpen}
        title={user ? "账号已登录" : "登录知屿英语"}
        description={user ? "每日计划与学习记录已连接 PocketBase。" : "使用邮箱继续，跨设备保存计划与复习记录。"}
        snap={0.84}
      >
        <div className="login-sheet">
          {user ? (
            <>
              <div className="signed-in-user">
                <span>{user.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{user.name}</strong><small>{user.email}</small></div>
                <i><b />云端同步已开启</i>
              </div>
              <button className="sheet-primary" type="button" onClick={() => setLoginOpen(false)}>继续学习</button>
              <button className="sheet-secondary" type="button" onClick={signOut}>退出登录</button>
            </>
          ) : (
            <>
              <div className="auth-tabs" role="tablist" aria-label="账号操作">
                <button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "is-active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>登录</button>
                <button type="button" role="tab" aria-selected={authMode === "register"} className={authMode === "register" ? "is-active" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>注册</button>
              </div>
              <form className="auth-form" onSubmit={submitAuth}>
                <label className="auth-field" htmlFor="mobile-auth-email">
                  <span>邮箱</span>
                  <KeyboardInput id="mobile-auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
                </label>
                <label className="auth-field" htmlFor="mobile-auth-password">
                  <span>密码</span>
                  <KeyboardInput id="mobile-auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={authMode === "register" ? "new-password" : "current-password"} />
                </label>
                {authMode === "register" && (
                  <label className="auth-field" htmlFor="mobile-auth-confirm">
                    <span>确认密码</span>
                    <KeyboardInput id="mobile-auth-confirm" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" />
                  </label>
                )}
                {authError && <div className="auth-error" role="alert">{authError}</div>}
                <button className="sheet-primary" type="submit" disabled={authBusy}>{authBusy ? "正在连接…" : authMode === "register" ? "创建账号并开始学习" : "登录并继续学习"}</button>
              </form>
              <div className="service-status"><span />PocketBase 服务在线 · pocket.nings.top</div>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
