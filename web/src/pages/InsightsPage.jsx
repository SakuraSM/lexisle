import { BarChartIcon, BookmarkIcon, ReaderIcon, ReloadIcon } from "@radix-ui/react-icons";
import { PageHeader, ProgressMeter } from "./PagePrimitives.jsx";

export function InsightsPage({ state }) {
  const completedArticles = state.articles.filter((article) => article.progress >= 100).length;
  const mastered = state.vocabulary.filter((word) => word.status === "mastered").length;
  const accuracy = state.reviewEvents.length ? Math.round(state.reviewEvents.filter((event) => event.result === "good" || event.result === "easy").length / state.reviewEvents.length * 100) : 82;
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  const activity = [35, 62, 48, 78, 55, 92, 68];
  const statusGroups = [
    ["新词", state.vocabulary.filter((item) => item.status === "new").length, "primary"],
    ["学习中", state.vocabulary.filter((item) => item.status === "learning").length, "amber"],
    ["待复习", state.vocabulary.filter((item) => item.status === "review").length, "success"],
    ["已掌握", mastered, "ink"],
  ];
  return (
    <div className="page insights-page">
      <PageHeader title="学习报告" description="看见积累，也看见下一步最值得投入的地方。" />
      <div className="metric-row"><article><ReaderIcon /><span>完成阅读</span><strong>{completedArticles}<small> 篇</small></strong></article><article><BookmarkIcon /><span>词汇总量</span><strong>{state.vocabulary.length}<small> 个</small></strong></article><article><ReloadIcon /><span>复习正确率</span><strong>{accuracy}<small>%</small></strong></article><article><BarChartIcon /><span>连续学习</span><strong>{state.streak}<small> 天</small></strong></article></div>
      <div className="insights-layout">
        <section className="activity-chart open-panel"><div className="section-heading"><div><h2>本周学习活跃度</h2><p>阅读、学习与复习的综合投入</p></div><strong>较上周 +18%</strong></div><div className="bars">{activity.map((value, index) => <div key={days[index]}><span style={{ height: `${value}%` }} /><small>{days[index]}</small></div>)}</div></section>
        <section className="word-distribution open-panel"><h2>词汇掌握分布</h2>{statusGroups.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong>{value}</strong><ProgressMeter value={value} max={state.vocabulary.length} tone={tone} /></div>)}</section>
      </div>
      <section className="learning-history open-panel"><div className="section-heading"><div><h2>最近学习记录</h2><p>所有数据在本机保存，登录后同步到 PocketBase</p></div></div><table><thead><tr><th>时间</th><th>学习动作</th><th>结果</th></tr></thead><tbody>{state.reviewEvents.slice(0, 6).map((event) => { const word = state.vocabulary.find((item) => item.id === event.vocabularyId); return <tr key={event.id}><td>{new Date(event.reviewedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td>复习 {word?.word || "单词"}</td><td>{event.result === "easy" ? "简单" : event.result === "good" ? "记得" : event.result === "hard" ? "困难" : "重来"}</td></tr>;})}{!state.reviewEvents.length ? <tr><td colSpan="3">完成第一次复习后，记录会出现在这里。</td></tr> : null}</tbody></table></section>
    </div>
  );
}
