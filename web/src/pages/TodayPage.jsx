import { useState } from "react";
import { ArrowRightIcon, BookmarkIcon, CheckCircledIcon, LightningBoltIcon, Pencil1Icon, ReaderIcon, ReloadIcon } from "@radix-ui/react-icons";
import { getLocalDateKey } from "../lib/date.js";
import { isDue } from "../lib/learning.js";
import { calculateStreak, createDailyPlan } from "../lib/stateModel.js";
import { PageHeader, ProgressMeter } from "./PagePrimitives.jsx";

export function TodayPage({ state, actions, navigate, openArticle, notify }) {
  const dateKey = getLocalDateKey();
  const plan = state.plans[dateKey] || createDailyPlan(dateKey, state.settings.dailyGoal);
  const [editing, setEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState(plan);
  const current = state.articles.find((article) => article.progress > 0 && article.progress < 100) || state.articles[0];
  const due = state.vocabulary.filter((item) => isDue(item));
  const streak = calculateStreak(state.plans, dateKey);
  const tasks = [
    { label: "阅读文章", value: plan.readingDone, target: plan.readingTarget, icon: ReaderIcon, tone: "primary", action: () => current ? openArticle(current.id) : navigate("图书馆") },
    { label: "学习生词", value: plan.wordDone, target: plan.wordTarget, icon: BookmarkIcon, tone: "amber", action: () => navigate("词汇本") },
    { label: "复习单词", value: plan.reviewDone, target: plan.reviewTarget, icon: ReloadIcon, tone: "success", action: () => navigate("复习") },
  ];
  const completion = Math.round(tasks.reduce((sum, task) => sum + Math.min(1, task.value / Math.max(1, task.target)), 0) / 3 * 100);

  return (
    <div className="page today-page">
      <PageHeader title="今天" description="专注完成今天最重要的学习任务。" action={<button className="secondary-button" type="button" onClick={() => { setDraftPlan(plan); setEditing(true); }}><Pencil1Icon />编辑计划</button>} />
      <section className="today-overview">
        <div className="today-score"><span>今日完成度</span><strong>{completion}%</strong><ProgressMeter value={completion} max={100} /><p><LightningBoltIcon /> 已连续学习 {streak} 天</p></div>
        <div className="task-strip">
          {tasks.map(({ label, value, target, icon: Icon, tone, action }) => (
            <button key={label} className={`task-item tone-${tone}`} type="button" onClick={action}>
              <Icon /><span>{label}</span><strong>{value}<small> / {target}</small></strong><ProgressMeter value={value} max={target} tone={tone} />
            </button>
          ))}
        </div>
      </section>

      <div className="today-columns">
        <section className="continue-reading open-panel">
          <div className="section-heading"><div><h2>继续阅读</h2><p>从上次停下的位置继续</p></div><button type="button" onClick={() => navigate("图书馆")}>全部文章 <ArrowRightIcon /></button></div>
          {current ? <article>
            <img src={current.image} alt="" />
            <div><span>{current.topic}</span><h3>{current.title}</h3><p>{current.source} · {current.difficulty}</p><ProgressMeter value={current.progress} max={100} /></div>
            <button className="primary-button" type="button" onClick={() => openArticle(current.id)}>继续阅读 <ArrowRightIcon /></button>
          </article> : <div className="empty-state"><h2>还没有文章</h2><p>先去图书馆导入一篇英文文章。</p><button className="primary-button" type="button" onClick={() => navigate("图书馆")}>导入文章 <ArrowRightIcon /></button></div>}
        </section>
        <section className="due-preview open-panel">
          <div className="section-heading"><div><h2>待复习</h2><p>{due.length ? `${due.length} 个单词已到复习时间` : "今天已全部完成"}</p></div><CheckCircledIcon /></div>
          <div className="due-word-list">
            {(due.length ? due : state.vocabulary.slice(0, 3)).slice(0, 4).map((item) => <div key={item.id}><strong>{item.word}</strong><span>{item.definition}</span></div>)}
          </div>
          <button className="secondary-button full" type="button" onClick={() => navigate("复习")}>{due.length ? "开始复习" : "查看复习记录"}<ArrowRightIcon /></button>
        </section>
      </div>
      {editing ? <div className="inline-modal-backdrop" role="presentation" onMouseDown={() => setEditing(false)}><form className="plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); actions.updatePlan(draftPlan); setEditing(false); notify("今日计划已更新"); }}><h2 id="plan-dialog-title">编辑今日计划</h2><p>目标应当有一点挑战，但每天都能完成。</p>{[["readingTarget", "阅读文章", "篇"], ["wordTarget", "学习生词", "个"], ["reviewTarget", "复习单词", "个"]].map(([key, label, unit]) => <label key={key}><span>{label}</span><div><input type="number" min="1" max="50" value={draftPlan[key]} onChange={(event) => setDraftPlan((value) => ({ ...value, [key]: Number(event.target.value) }))} /><em>{unit}</em></div></label>)}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setEditing(false)}>取消</button><button className="primary-button" type="submit">保存计划</button></div></form></div> : null}
    </div>
  );
}
