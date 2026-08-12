import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkFilledIcon, BookmarkIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { analyzeText, speak } from "../lib/learning.js";
import { ProgressMeter } from "./PagePrimitives.jsx";

function Paragraph({ text, candidates, onWord }) {
  const known = new Map(candidates.map((item) => [item.word, item]));
  return <p>{text.split(/([A-Za-z]+(?:'[A-Za-z]+)?)/g).map((part, index) => {
    const item = known.get(part.toLowerCase());
    return item ? <button key={`${part}-${index}`} className="inline-word status-new" type="button" onClick={() => onWord(item)}>{part}</button> : part;
  })}</p>;
}

export function ReaderPage({ article, state, actions, close, notify }) {
  const analyzed = useMemo(() => article.analysis?.length ? article.analysis : analyzeText(article.text), [article.analysis, article.text]);
  const [active, setActive] = useState(analyzed[0] || null);
  const savedWords = new Set(state.vocabulary.map((item) => item.word.toLowerCase()));
  const paragraphs = article.text.split(/\n\s*\n/).filter(Boolean);

  const saveWord = () => {
    if (!active) return;
    const existed = savedWords.has(active.word);
    actions.addVocabulary(active, article.id);
    notify(existed ? `${active.word} 已在词汇本中` : `${active.word} 已加入词汇本，并安排明天复习`);
  };

  const continueReading = () => {
    const next = Math.min(100, article.progress + 12);
    actions.updateProgress(article.id, next);
    notify(next === 100 ? "文章阅读完成，今日计划已更新" : `阅读进度已保存到 ${next}%`);
  };

  return (
    <div className="reader-workspace">
      <main className="immersive-reader open-panel">
        <div className="reader-toolbar"><button type="button" onClick={close}><ArrowLeftIcon /> 返回图书馆</button><span>{article.source} · {article.difficulty}</span><button type="button" onClick={() => actions.toggleArticleSaved(article.id)}>{article.saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}{article.saved ? "已收藏" : "稍后读"}</button></div>
        <header className="imported-article-header"><div><span>{article.topic}</span><h1>{article.title}</h1><p>{analyzed.length} 个重点词汇已穿插在原文中，点击高亮单词查看解释。</p></div><img src={article.image} alt="" /></header>
        <div className="imported-article-body">{paragraphs.map((paragraph, index) => <Paragraph key={index} text={paragraph} candidates={analyzed} onWord={setActive} />)}</div>
        <footer className="article-footer"><span>文章进度：{article.progress}%</span><ProgressMeter value={article.progress} max={100} /><button type="button" onClick={continueReading}>{article.progress >= 100 ? "再次阅读" : "继续阅读"}<ArrowRightIcon /></button></footer>
      </main>

      <aside className="word-inspector open-panel">
        {active ? <>
          <div className="inspector-status"><span>语境词汇</span><button className="sound-circle" type="button" onClick={() => speak(active.word)}><SpeakerLoudIcon /></button></div>
          <h2>{active.word}</h2><p className="phonetic">{active.phonetic || "重点词汇"} {active.part}</p><strong>{active.definition}</strong>
          <div className="context-quote"><span>原文语境</span><p>{active.example}</p></div>
          <button className="primary-button full" type="button" onClick={saveWord}>{savedWords.has(active.word) ? "已加入词汇本" : "加入词汇本"}<BookmarkIcon /></button>
          <div className="learning-explain"><h3>这样记</h3><p>先理解它在这句话中的作用，再用自己的话复述整句。明天 Lexisle 会安排第一次复习。</p></div>
        </> : <div className="empty-state"><h2>点击高亮词汇</h2><p>释义、发音和原句会显示在这里。</p></div>}
        <div className="word-map"><div className="section-heading"><div><h3>本文生词</h3><p>{analyzed.length} 个</p></div></div>{analyzed.slice(0, 10).map((item, index) => <button key={item.word} className={active?.word === item.word ? "is-active" : ""} type="button" onClick={() => setActive(item)}><span>{index + 1}</span><div><strong>{item.word}</strong><small>{item.definition}</small></div></button>)}</div>
      </aside>
    </div>
  );
}
