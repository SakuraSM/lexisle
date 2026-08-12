import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircledIcon,
  HeartIcon,
  LightningBoltIcon,
  PersonIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";

const answers = [
  "快速移动；迅速行动",
  "适应；改变以适合环境",
  "恢复力；在困难后仍能恢复并继续",
  "危险；可能造成伤害的事物",
];

const initialLesson = { progress: 1, streak: 12, saved: false };

export function MobileLesson({ user, onAccountOpen }) {
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [lesson, setLesson] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem("lexisle-lesson") || "null") || initialLesson;
    } catch {
      return initialLesson;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("lexisle-lesson", JSON.stringify(lesson));
  }, [lesson]);

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

  return (
    <main className="responsive-mobile app-screen" aria-label="Lexisle 移动端单词学习">
      <div className="lesson-screen">
        <header className="lesson-header">
          <div className="brand-row">
            <strong className="brand">Lexisle</strong>
            <button className="account-button" type="button" onClick={onAccountOpen}>
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
            As cities grow, wildlife shows a remarkable <mark>resilience</mark>. From raccoons navigating
            alleys to hawks nesting on skyscrapers, these animals adapt in ways that surprise us.
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

        {checked ? (
          <section className={`feedback ${correct ? "is-correct" : "is-incorrect"}`} aria-live="polite">
            <CheckCircledIcon />
            <div>
              <h3>{correct ? "正确！" : "再想一下"}</h3>
              <p><strong>resilience</strong> 指“从困难中恢复并继续”的能力。</p>
            </div>
          </section>
        ) : null}

        <button className="primary-action" type="button" disabled={selected === null} onClick={handlePrimary}>
          <span>{checked ? "继续" : "检查答案"}</span>
          <ArrowRightIcon />
        </button>

        <div className="review-note">
          <BookmarkIcon />
          <span>{lesson.saved ? "已保存到词汇本，并安排明天复习" : "答对后自动保存，并按记忆曲线安排复习"}</span>
        </div>
      </div>
    </main>
  );
}
