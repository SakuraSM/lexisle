import { useMemo, useState } from "react";
import { CheckCircledIcon, ReloadIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { getLocalDateKey } from "../lib/date.js";
import { isDue, previewReviewSchedule, speak } from "../lib/learning.js";
import { EmptyState, PageHeader, ProgressMeter } from "./PagePrimitives.jsx";

const resultLabels = { again: "重来", hard: "困难", good: "记得", easy: "简单" };

export function ReviewPage({ state, actions, notify }) {
  const initialQueue = useMemo(() => {
    const due = state.vocabulary.filter((item) => isDue(item));
    return due.length ? due : state.vocabulary.filter((item) => item.status !== "mastered").slice(0, 5);
  }, [state.vocabulary]);
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const current = queue[index];
  const todayPlan = state.plans[getLocalDateKey()];

  const grade = (result) => {
    actions.recordReview(current.id, result, Date.now() - startedAt);
    setRevealed(false);
    setStartedAt(Date.now());
    if (index + 1 >= queue.length) {
      setIndex(queue.length);
      notify(`完成 ${queue.length} 个单词复习`);
    } else setIndex((value) => value + 1);
  };

  const restart = () => { setQueue(state.vocabulary.filter((item) => item.status !== "mastered").slice(0, 8)); setIndex(0); setRevealed(false); setStartedAt(Date.now()); };

  return (
    <div className="page review-page">
      <PageHeader title="复习" description="根据记忆曲线，在即将遗忘时巩固单词。" action={<div className="review-count"><ReloadIcon /> 今日已复习 <strong>{todayPlan?.reviewDone || 0}</strong> 个</div>} />
      <div className="review-layout">
        <section className="review-stage open-panel">
          <div className="review-progress"><span>{Math.min(index + 1, queue.length)} / {queue.length}</span><ProgressMeter value={index} max={queue.length || 1} /></div>
          {current ? <div className={`flashcard ${revealed ? "is-revealed" : ""}`}>
            <button className="sound-circle" type="button" aria-label={`播放 ${current.word} 发音`} onClick={() => speak(current.word)}><SpeakerLoudIcon /></button>
            <span>{current.status === "new" ? "新词" : "间隔复习"}</span><h2>{current.word}</h2><p>{current.phonetic} {current.part}</p>
            <div className="flash-context"><small>回忆它在这句话中的意思</small><blockquote>{current.example}</blockquote></div>
            {revealed ? <div className="answer-reveal"><strong>{current.definition}</strong><p>上次间隔 {current.intervalDays} 天 · 已复习 {current.repetition} 次</p></div> : <button className="primary-button" type="button" onClick={() => setRevealed(true)}>显示答案</button>}
          </div> : <EmptyState title="本轮复习完成" description="这些单词已经重新进入你的记忆轨迹。" actionLabel="再练一组" onAction={restart} />}
          {current && revealed ? <div className="grade-row">{Object.entries(resultLabels).map(([result, label]) => { const preview = previewReviewSchedule(current, result); return <button key={result} type="button" onClick={() => grade(result)}><strong>{label}</strong><span>{preview.intervalDays} 天</span></button>; })}</div> : null}
        </section>
        <aside className="review-sidebar open-panel"><h2>今日复习</h2><div className="review-ring"><strong>{todayPlan?.reviewDone || 0}</strong><span>已完成</span></div><ul><li><CheckCircledIcon /><span>到期单词</span><strong>{initialQueue.length}</strong></li><li><CheckCircledIcon /><span>掌握词汇</span><strong>{state.vocabulary.filter((item) => item.status === "mastered").length}</strong></li><li><CheckCircledIcon /><span>平均记忆强度</span><strong>{state.vocabulary.length ? Math.round(state.vocabulary.reduce((sum, item) => sum + Math.min(100, item.repetition * 16), 0) / state.vocabulary.length) : 0}%</strong></li></ul></aside>
      </div>
    </div>
  );
}
