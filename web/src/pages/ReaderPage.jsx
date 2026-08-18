import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkFilledIcon, BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon, GlobeIcon, ReloadIcon, SpeakerLoudIcon } from "@radix-ui/react-icons";
import { lookupWordWithAi, translateReaderSegment } from "../lib/aiVocabulary.js";
import { analyzeText, speak } from "../lib/learning.js";
import { createReaderData, getSentenceForWord, getWordCacheKey } from "../lib/reader.js";
import { ProgressMeter } from "./PagePrimitives.jsx";

const WORD_SPLIT_PATTERN = /([A-Za-z]+(?:'[A-Za-z]+)?)/g;
const WORD_ONLY_PATTERN = /^[A-Za-z]+(?:'[A-Za-z]+)?$/;

function FreeParagraph({ text, candidates, onWord }) {
  const known = new Map(candidates.map((item) => [item.word, item]));
  let offset = 0;
  return <p>{text.split(WORD_SPLIT_PATTERN).map((part) => {
    const key = `${offset}-${part}`;
    offset += part.length;
    const item = known.get(part.toLowerCase());
    return item ? <button key={key} className="inline-word status-new" type="button" onClick={() => onWord(item, text)}>{part}</button> : <span key={key}>{part}</span>;
  })}</p>;
}

function FocusParagraph({ segment, candidates, activeWord, onWord, onEscape }) {
  const containerRef = useRef(null);
  const known = new Map(candidates.map((item) => [item.word.toLowerCase(), item]));
  const tokens = segment.text.split(WORD_SPLIT_PATTERN);
  const firstWordIndex = tokens.findIndex((token) => WORD_ONLY_PATTERN.test(token));
  const activeWordIndex = activeWord ? tokens.findIndex((token) => WORD_ONLY_PATTERN.test(token) && token.toLowerCase() === activeWord) : -1;

  const moveFocus = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)) return;
    if (event.key === "Escape") {
      onEscape();
      event.currentTarget.blur();
      return;
    }
    event.preventDefault();
    const buttons = [...containerRef.current.querySelectorAll("button[data-reader-word]")];
    const index = buttons.indexOf(event.currentTarget);
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  };

  let offset = 0;
  return (
    <p ref={containerRef} className="focus-paragraph" aria-label={`当前阅读段落，第 ${segment.index + 1} 段`}>
      {tokens.map((token, tokenIndex) => {
        const key = `${offset}-${token}`;
        offset += token.length;
        if (!WORD_ONLY_PATTERN.test(token)) return <span key={key}>{token}</span>;
        const normalized = token.toLowerCase();
        const keyword = known.get(normalized);
        return <button key={key} data-reader-word type="button" tabIndex={tokenIndex === (activeWordIndex >= 0 ? activeWordIndex : firstWordIndex) ? 0 : -1} className={`reader-word ${keyword ? "is-keyword" : ""} ${activeWord === normalized ? "is-active" : ""}`} onKeyDown={moveFocus} onClick={() => onWord(keyword || { word: normalized, definition: "本地词典暂无释义", part: "" }, getSentenceForWord(segment.text, normalized), segment)}>{token}</button>;
      })}
    </p>
  );
}

function ReaderModeTabs({ mode, onChange }) {
  const handleKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "ArrowLeft" || event.key === "Home" ? "free" : "focus";
    onChange(nextMode);
    event.currentTarget.parentElement.querySelector(`#reader-mode-${nextMode}`)?.focus();
  };
  return (
    <div className="reader-mode-tabs" role="tablist" aria-label="阅读模式">
      <button id="reader-mode-free" type="button" role="tab" aria-selected={mode === "free"} aria-controls="reader-content-free" tabIndex={mode === "free" ? 0 : -1} className={mode === "free" ? "is-active" : ""} onKeyDown={handleKeyDown} onClick={() => onChange("free")}>自由阅读</button>
      <button id="reader-mode-focus" type="button" role="tab" aria-selected={mode === "focus"} aria-controls="reader-content-focus" tabIndex={mode === "focus" ? 0 : -1} className={mode === "focus" ? "is-active" : ""} onKeyDown={handleKeyDown} onClick={() => onChange("focus")}>阅读记词</button>
    </div>
  );
}

function WordInspector({ active, detail, isSaved, aiEnabled, detailBusy, detailError, onSave, onSpeak, onRetry, onConfigure, onClose }) {
  if (!active) return <div className="empty-state"><h2>点击英文单词</h2><p>基础释义、发音和原句会显示在这里。</p></div>;
  return (
    <>
      <div className="inspector-status"><span>{detail?.source === "ai" ? "AI 语境详解" : "语境词汇"}</span><div><button className="sound-circle" type="button" aria-label={`播放 ${active.word} 发音`} onClick={onSpeak}><SpeakerLoudIcon /></button><button className="inspector-close" type="button" aria-label="关闭单词详情" onClick={onClose}><Cross2Icon /></button></div></div>
      <h2>{detail?.lemma || active.word}</h2>
      <p className="phonetic">{detail?.phonetic || active.phonetic || "等待详细音标"} {detail?.part || active.part}</p>
      <strong>{detail?.contextMeaning || detail?.definition || active.definition || "结合当前语境理解这个单词"}</strong>
      <div className="context-quote"><span>当前语境</span><p>{active.sentence || active.example}</p>{detail?.contextExplanation ? <small>{detail.contextExplanation}</small> : null}</div>
      {detail?.meanings?.length ? <div className="word-detail-section"><h3>常用含义</h3><ul>{detail.meanings.map((meaning) => <li key={meaning}>{meaning}</li>)}</ul></div> : null}
      {detail?.collocations?.length ? <div className="word-detail-section"><h3>常用搭配</h3><div className="collocation-list">{detail.collocations.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
      {detail?.memoryTip ? <div className="learning-explain"><h3>这样记</h3><p>{detail.memoryTip}</p></div> : null}
      {detailBusy ? <div className="reader-ai-status" role="status">正在补充语境含义和常用搭配…</div> : null}
      {detailError ? <div className="recovery-notice" role="alert"><span>{detailError}</span><button type="button" onClick={onRetry}>重试</button></div> : null}
      {!aiEnabled ? <div className="reader-ai-gate"><p>配置 AI 后可查看语境解释、常用含义和搭配。</p><button type="button" onClick={onConfigure}>配置 AI</button></div> : null}
      <button className="primary-button full" type="button" disabled={isSaved} onClick={onSave}>{isSaved ? "已加入生词本" : "加入生词本"}<BookmarkIcon /></button>
    </>
  );
}

export function ReaderPage({ article, state, actions, close, navigate, notify }) {
  const analyzed = useMemo(() => article.analysis?.length ? article.analysis : analyzeText(article.text), [article.analysis, article.text]);
  const readerData = useMemo(() => createReaderData(article, article.readerData), [article]);
  const currentIndex = Math.max(0, readerData.segments.findIndex((segment) => segment.id === readerData.currentSegmentId));
  const currentSegment = readerData.segments[currentIndex] || readerData.segments[0];
  const [active, setActive] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const savedWords = new Set(state.vocabulary.map((item) => item.word.toLowerCase()));
  const paragraphs = article.text.split(/\n\s*\n/).filter(Boolean);
  const aiEnabled = Boolean(state.settings.ai?.enabled && state.settings.ai.endpoint && state.settings.ai.model);
  const activeCacheKey = active?.segmentId ? getWordCacheKey(active.segmentId, active.word) : "";
  const detail = activeCacheKey ? readerData.wordDetails[activeCacheKey] : active;
  const translation = currentSegment ? readerData.translations[currentSegment.id] : null;

  useEffect(() => {
    setActive(null);
    setDetailError("");
    setTranslationError("");
  }, [currentSegment?.id, readerData.mode]);

  useEffect(() => {
    if (!active || readerData.mode !== "focus") return undefined;
    const closeInspector = (event) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", closeInspector);
    return () => window.removeEventListener("keydown", closeInspector);
  }, [active, readerData.mode]);

  const updateReader = (patch) => actions.updateReaderProgress(article.id, patch);
  const changeMode = (mode) => updateReader({ mode });

  const selectFreeWord = (item, sentence) => {
    setActive({ ...item, sentence });
    if (!state.settings.autoSaveWords || savedWords.has(item.word.toLowerCase())) return;
    actions.addVocabulary(item, article.id);
    notify(`${item.word} 已按自由阅读偏好自动加入词汇本`);
  };

  const requestWordDetail = async (wordEntry, sentence, segment, force = false) => {
    const activeWord = { ...wordEntry, sentence, segmentId: segment.id, example: sentence };
    setActive(activeWord);
    setDetailError("");
    const cacheKey = getWordCacheKey(segment.id, wordEntry.word);
    if (!aiEnabled || (!force && readerData.wordDetails[cacheKey])) return;
    setDetailBusy(true);
    try {
      const result = await lookupWordWithAi(state.settings.ai, wordEntry.word, sentence, segment);
      updateReader({ wordDetails: { ...readerData.wordDetails, [cacheKey]: { ...result, updatedAt: new Date().toISOString() } } });
    } catch (error) {
      setDetailError(error.message || "暂时无法获取丰富词义，基础查词仍可使用。");
    } finally {
      setDetailBusy(false);
    }
  };

  const translateCurrent = async (force = false) => {
    if (!currentSegment) return;
    if (!aiEnabled) { setTranslationError("请先登录并配置服务端 AI，基础阅读和查词不受影响。"); return; }
    if (!force && translation) return;
    setTranslationBusy(true);
    setTranslationError("");
    try {
      const result = await translateReaderSegment(state.settings.ai, currentSegment, {
        previous: readerData.segments[currentIndex - 1]?.text || "",
        next: readerData.segments[currentIndex + 1]?.text || "",
      });
      updateReader({ translations: { ...readerData.translations, [currentSegment.id]: { ...result, updatedAt: new Date().toISOString() } } });
    } catch (error) {
      setTranslationError(error.message || "翻译失败，请稍后重试。");
    } finally {
      setTranslationBusy(false);
    }
  };

  const saveWord = () => {
    if (!active) return;
    const wordData = { ...active, ...detail, word: active.word, example: active.sentence || active.example };
    const existed = savedWords.has(active.word.toLowerCase());
    actions.addVocabulary(wordData, article.id);
    notify(existed ? `${active.word} 已在词汇本中` : `${active.word} 已加入词汇本，并安排明天复习`);
  };

  const continueFreeReading = () => {
    const next = Math.min(100, readerData.freeProgress + 12);
    actions.updateProgress(article.id, next);
    notify(next === 100 ? "文章阅读完成，今日计划已更新" : `自由阅读进度已保存到 ${next}%`);
  };

  const goToSegment = (index, completeCurrent = false) => {
    const target = readerData.segments[index];
    if (!target) return;
    const completed = completeCurrent && currentSegment ? [...new Set([...readerData.completedSegmentIds, currentSegment.id])] : readerData.completedSegmentIds;
    updateReader({ currentSegmentId: target.id, completedSegmentIds: completed });
  };

  const completeLastSegment = () => {
    if (!currentSegment) return;
    updateReader({ completedSegmentIds: [...new Set([...readerData.completedSegmentIds, currentSegment.id])] });
    notify("文章逐段阅读已完成");
  };

  const progressIndex = readerData.segments.findIndex((segment) => !readerData.completedSegmentIds.includes(segment.id));

  return (
    <div className={`reader-workspace mode-${readerData.mode}`}>
      <section className="immersive-reader open-panel">
        <div className="reader-toolbar"><button type="button" onClick={close}><ArrowLeftIcon /> 返回图书馆</button><ReaderModeTabs mode={readerData.mode} onChange={changeMode} /><button type="button" onClick={() => actions.toggleArticleSaved(article.id)}>{article.saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}{article.saved ? "已收藏" : "稍后读"}</button></div>
        <header className="imported-article-header"><div><span>{article.topic}</span><h1>{article.title}</h1><p>{readerData.mode === "focus" ? "逐段理解语境，点击任意英文单词查看解释。" : `${analyzed.length} 个重点词汇已穿插在原文中，点击高亮单词查看解释。`}</p></div><img src={article.image} alt="" /></header>

        {readerData.mode === "free" ? <div id="reader-content-free" role="tabpanel" aria-labelledby="reader-mode-free" className="imported-article-body">{paragraphs.map((paragraph) => <FreeParagraph key={`${article.id}-${paragraph.slice(0, 80)}`} text={paragraph} candidates={analyzed} onWord={selectFreeWord} />)}</div> : (
          <div id="reader-content-focus" role="tabpanel" aria-labelledby="reader-mode-focus" className="focus-reader-stage">
            <div className="segment-progress"><div><span>第 {currentIndex + 1} / {readerData.segments.length} 段</span><strong>{currentSegment?.wordCount || 0} 词</strong></div><ProgressMeter value={readerData.completedSegmentIds.length} max={Math.max(1, readerData.segments.length)} /></div>
            {currentSegment ? <div key={currentSegment.id} className="focus-segment-card"><FocusParagraph segment={currentSegment} candidates={analyzed} activeWord={active?.word} onWord={requestWordDetail} onEscape={() => setActive(null)} />
              <div className="segment-translation-actions"><button type="button" disabled={translationBusy} onClick={() => translateCurrent(Boolean(translation))}>{translationBusy ? <ReloadIcon className="is-spinning" /> : <GlobeIcon />}{translation ? "重新生成翻译" : "翻译当前段"}</button>{!aiEnabled ? <span>登录并配置服务端 AI 后可使用在线翻译</span> : null}</div>
              {translation ? <div className="segment-translation"><span>中文翻译</span><p>{translation.translation}</p></div> : null}
              {translationError ? <div className="recovery-notice" role="alert"><span>{translationError}</span><button type="button" onClick={aiEnabled ? () => translateCurrent(true) : () => navigate("设置")}>{aiEnabled ? "重试" : "配置 AI"}</button></div> : null}
            </div> : null}
            <div className="segment-navigation"><button type="button" disabled={currentIndex === 0} onClick={() => goToSegment(currentIndex - 1)}><ChevronLeftIcon />上一段</button>{progressIndex >= 0 && progressIndex !== currentIndex ? <button className="return-progress" type="button" onClick={() => goToSegment(progressIndex)}>回到当前进度</button> : <span />}{currentIndex < readerData.segments.length - 1 ? <button className="primary-button" type="button" onClick={() => goToSegment(currentIndex + 1, true)}>完成并读下一段<ChevronRightIcon /></button> : <button className="primary-button" type="button" disabled={readerData.completedSegmentIds.includes(currentSegment?.id)} onClick={completeLastSegment}>{readerData.completedSegmentIds.includes(currentSegment?.id) ? "全文已完成" : "完成全文"}<ArrowRightIcon /></button>}</div>
          </div>
        )}

        {readerData.mode === "free" ? <footer className="article-footer"><span>文章进度：{article.progress}%</span><ProgressMeter value={article.progress} max={100} /><button type="button" onClick={continueFreeReading}>{article.progress >= 100 ? "再次阅读" : "继续阅读"}<ArrowRightIcon /></button></footer> : null}
      </section>

      <aside className={`word-inspector open-panel ${active ? "is-open" : ""}`} aria-label="单词详情">
        <WordInspector active={active} detail={detail} isSaved={active ? savedWords.has(active.word.toLowerCase()) : false} aiEnabled={aiEnabled} detailBusy={detailBusy} detailError={detailError} onSave={saveWord} onSpeak={() => speak(active.word)} onRetry={() => requestWordDetail(active, active.sentence, currentSegment, true)} onConfigure={() => navigate("设置")} onClose={() => setActive(null)} />
        {readerData.mode === "free" ? <div className="word-map"><div className="section-heading"><div><h3>本文生词</h3><p>{analyzed.length} 个</p></div></div>{analyzed.slice(0, 10).map((item, index) => <button key={item.word} className={active?.word === item.word ? "is-active" : ""} type="button" onClick={() => setActive({ ...item, sentence: item.example })}><span>{index + 1}</span><div><strong>{item.word}</strong><small>{item.definition}</small></div></button>)}</div> : null}
      </aside>
    </div>
  );
}
