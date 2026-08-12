import { useMemo, useState } from "react";
import { Cross2Icon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { formatDue, speak } from "../lib/learning.js";
import { EmptyState, PageHeader, SearchField } from "./PagePrimitives.jsx";

const labels = { all: "全部", new: "新词", learning: "学习中", review: "待复习", mastered: "已掌握" };

export function VocabularyPage({ state, actions }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const items = useMemo(() => state.vocabulary.filter((item) => (filter === "all" || item.status === filter) && (!query || `${item.word} ${item.definition}`.toLowerCase().includes(query.toLowerCase()))), [state.vocabulary, filter, query]);
  const active = state.vocabulary.find((item) => item.id === selected) || items[0];

  return (
    <div className="page vocabulary-page">
      <PageHeader title="词汇本" description={`共保存 ${state.vocabulary.length} 个语境词汇。`} />
      <div className="vocab-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索单词或中文释义" /><div className="filter-tabs">{Object.entries(labels).map(([key, label]) => <button key={key} className={filter === key ? "is-active" : ""} type="button" onClick={() => setFilter(key)}>{label}<span>{key === "all" ? state.vocabulary.length : state.vocabulary.filter((item) => item.status === key).length}</span></button>)}</div></div>
      <div className="vocab-layout">
        <section className="vocab-table open-panel">{items.length ? <table><thead><tr><th>单词</th><th>语境释义</th><th>状态</th><th>下次复习</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={active?.id === item.id ? "is-selected" : ""} onClick={() => setSelected(item.id)}><td><strong>{item.word}</strong><small>{item.phonetic}</small></td><td>{item.definition}</td><td><span className={`status-tag ${item.status}`}>{labels[item.status]}</span></td><td>{formatDue(item.nextReviewAt)}</td></tr>)}</tbody></table> : <EmptyState title="没有找到词汇" description="试试其他关键词或筛选条件。" />}</section>
        <aside className="vocab-detail open-panel">{active ? <><button className="delete-word" type="button" onClick={() => actions.removeVocabulary(active.id)} aria-label="移除词汇"><Cross2Icon /></button><div className="inspector-status"><span>{labels[active.status]}</span><button className="sound-circle" type="button" onClick={() => speak(active.word)}><SpeakerLoudIcon /></button></div><h2>{active.word}</h2><p className="phonetic">{active.phonetic} {active.part}</p><strong>{active.definition}</strong><div className="context-quote"><span>收藏时的语境</span><p>{active.example}</p></div><dl><div><dt>已复习</dt><dd>{active.repetition} 次</dd></div><div><dt>当前间隔</dt><dd>{active.intervalDays} 天</dd></div><div><dt>记忆难度</dt><dd>{active.easeFactor}</dd></div></dl></> : null}</aside>
      </div>
    </div>
  );
}
