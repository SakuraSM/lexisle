import { useMemo, useState } from "react";
import { ArrowRightIcon, BookmarkFilledIcon, BookmarkIcon, Link2Icon, ReaderIcon, TrashIcon } from "@radix-ui/react-icons";
import { analyzeText } from "../lib/learning.js";
import { analyzeVocabularyWithAi, readAiApiKey } from "../lib/aiVocabulary.js";
import { EmptyState, PageHeader, ProgressMeter } from "./PagePrimitives.jsx";

function cleanReaderText(raw) {
  return raw.replace(/^Title:.*$/gm, "").replace(/^URL Source:.*$/gm, "").replace(/^Markdown Content:.*$/gm, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function LibraryPage({ state, actions, openArticle, navigate, notify }) {
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("全部");
  const [importDifficulty, setImportDifficulty] = useState(state.settings.difficulty);
  const [savedOnly, setSavedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [confirmArticleId, setConfirmArticleId] = useState("");

  const articles = useMemo(() => state.articles.filter((article) => (!savedOnly || article.saved) && (difficultyFilter === "全部" || article.difficulty === difficultyFilter)), [state.articles, savedOnly, difficultyFilter]);

  const importArticle = async (event) => {
    event.preventDefault();
    setError("");
    setAnalysisNotice("");
    setBusy(true);
    try {
      let articleText = text.trim();
      let articleTitle = title.trim();
      if (mode === "url") {
        if (!/^https?:\/\//i.test(url)) throw new Error("请输入完整的 http(s) 文章链接。");
        const response = await fetch(`https://r.jina.ai/${url}`);
        if (!response.ok) throw new Error("无法读取此链接，请切换为粘贴英文原文。");
        const raw = await response.text();
        articleText = cleanReaderText(raw);
        articleTitle ||= raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || new URL(url).hostname;
      }
      if (articleText.split(/\s+/).length < 40) throw new Error("文章内容太短，请至少提供 40 个英文单词。");
      let aiAnalysis;
      let analysisMode = "本地";
      let aiFallbackReason = "";
      if (state.settings.ai?.enabled) {
        try {
          aiAnalysis = await analyzeVocabularyWithAi(state.settings.ai, articleText, readAiApiKey());
          analysisMode = `AI · ${state.settings.ai.model}`;
        } catch (aiError) {
          aiFallbackReason = aiError.message;
          setAnalysisNotice(`AI 分析未完成，已使用本地识别：${aiError.message}`);
        }
      }
      const { article, analyzed } = actions.addArticle({ title: articleTitle, url: mode === "url" ? url : "", text: articleText, difficulty: importDifficulty, analysis: aiAnalysis });
      notify(`${analysisMode} 分析完成：识别到 ${analyzed.length} 个重点词汇${aiFallbackReason ? `；AI 未使用：${aiFallbackReason}` : ""}`);
      openArticle(article.id);
      setUrl(""); setTitle(""); setText("");
    } catch (importError) {
      setError(importError.message || "文章导入失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page library-page">
      <PageHeader title="图书馆" description="导入在线英文文章，在原文语境中学习生词。" />
      <div className="library-layout">
        <div className="library-primary">
          <section className="import-panel open-panel">
            <div className="section-heading"><div><h2>导入英文文章</h2><p>链接读取或直接粘贴原文 · {state.settings.ai?.enabled ? `AI ${state.settings.ai.model || "待配置"}` : "本地识别"}</p></div><ReaderIcon /></div>
            <div className="segmented-control"><button className={mode === "url" ? "is-active" : ""} type="button" onClick={() => setMode("url")}>粘贴文章链接</button><button className={mode === "text" ? "is-active" : ""} type="button" onClick={() => setMode("text")}>粘贴英文原文</button></div>
            <form className="import-form" onSubmit={importArticle}>
              {mode === "url" ? <label className="url-field"><span className="sr-only">英文文章链接</span><Link2Icon /><input aria-label="英文文章链接" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/english-article" /></label> : <><label className="sr-only" htmlFor="article-title">文章标题</label><input id="article-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="文章标题" /><label className="sr-only" htmlFor="article-text">英文文章原文</label><textarea id="article-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="在这里粘贴完整英文文章……" rows="6" /></>}
              <label className="import-difficulty"><span>导入难度</span><select value={importDifficulty} onChange={(event) => setImportDifficulty(event.target.value)}><option>初级</option><option>中级</option><option>中高级</option><option>高级</option></select></label>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              {analysisNotice ? <div className="recovery-notice" role="status"><span>{analysisNotice}</span><button type="button" onClick={() => navigate("设置")}>检查 AI 设置</button></div> : null}
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "正在读取并分析…" : "开始分析"}<ArrowRightIcon /></button>
            </form>
          </section>

          <section className="article-library open-panel">
            <div className="section-heading"><div><h2>{savedOnly ? "已收藏" : "最近阅读"}</h2><p>{articles.length} 篇文章</p></div><button type="button" onClick={() => setSavedOnly((value) => !value)}>{savedOnly ? "查看全部" : "只看收藏"}</button></div>
            <div className="filter-row"><span>难度</span>{["全部", "初级", "中级", "中高级", "高级"].map((level) => <button key={level} className={difficultyFilter === level ? "is-active" : ""} type="button" onClick={() => setDifficultyFilter(level)}>{level}</button>)}</div>
            {articles.length ? <div className="article-list">{articles.map((article) => {
              const analyzed = article.analysis?.length ? article.analysis : analyzeText(article.text);
              return <article key={article.id}><img src={article.image} alt="" /><div><h3>{article.title}</h3><p>{new Date(article.createdAt).toLocaleDateString("zh-CN")} · {article.text.split(/\s+/).length} 词 · 生词 {analyzed.length} 个 · {article.difficulty}</p><ProgressMeter value={article.progress} max={100} />{confirmArticleId === article.id ? <div className="article-delete-confirm" role="alert"><span>删除后会同步到其他设备</span><button type="button" onClick={() => setConfirmArticleId("")}>取消</button><button type="button" className="danger-link" onClick={() => { actions.deleteArticle(article.id); setConfirmArticleId(""); }}>确认删除</button></div> : null}</div><div className="article-row-actions"><button className="icon-button" type="button" aria-label={article.saved ? "取消收藏" : "收藏"} onClick={() => actions.toggleArticleSaved(article.id)}>{article.saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}</button><button className="icon-button" type="button" aria-label={`删除文章 ${article.title}`} onClick={() => setConfirmArticleId(article.id)}><TrashIcon /></button></div><button className="secondary-button" type="button" onClick={() => openArticle(article.id)}>{article.progress ? "继续阅读" : "开始阅读"}<ArrowRightIcon /></button></article>;
            })}</div> : <EmptyState title="暂无符合条件的文章" description="调整筛选条件或导入一篇新的英文文章。" />}
          </section>
        </div>
        <aside className="library-aside open-panel">
          <h2>分析能力</h2>
          <ol><li><strong>1</strong><div><b>清理文章正文</b><span>去除导航、图片链接和多余格式</span></div></li><li><strong>2</strong><div><b>{state.settings.ai?.enabled ? "AI 语境识词" : "本地识别词汇"}</b><span>{state.settings.ai?.enabled ? "由自定义模型分析难度、释义和原句" : "结合词频、词长和内置学习词典"}</span></div></li><li><strong>3</strong><div><b>生成复习计划</b><span>收藏后按记忆曲线安排复习</span></div></li></ol>
          <p>AI 配置保存在当前浏览器；接口不可用时自动回退本地识别，不阻塞文章导入。</p>
        </aside>
      </div>
    </div>
  );
}
