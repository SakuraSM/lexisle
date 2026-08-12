import { useCallback, useEffect, useMemo, useState } from "react";
import { seedState, todayKey } from "../data/seed.js";
import { analyzeText, reviewWord } from "./learning.js";

const STORAGE_KEY = "lexisle:data:v1";

function readState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.version === 1) return {
      ...seedState,
      ...stored,
      settings: { ...seedState.settings, ...stored.settings, ai: { ...seedState.settings.ai, ...stored.settings?.ai } },
    };
  } catch {
    // Invalid user data is replaced by the recoverable seed below.
  }
  return structuredClone(seedState);
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useLexisleStore() {
  const [state, setState] = useState(readState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((recipe) => {
    setState((current) => recipe(current));
  }, []);

  const addArticle = useCallback(({ title, source, url, text, difficulty = "中级", analysis }) => {
    const id = uid("article");
    const article = {
      id,
      title: title.trim() || "未命名英文文章",
      source: source || (url ? new URL(url).hostname.replace(/^www\./, "") : "手动粘贴"),
      topic: "自定义阅读",
      url: url || `local://${id}`,
      image: "/assets/deep-sleep-bedroom.png",
      difficulty,
      createdAt: new Date().toISOString(),
      saved: false,
      progress: 0,
      text: text.trim(),
      analysis: analysis?.length ? analysis : undefined,
    };
    const analyzed = article.analysis || analyzeText(article.text);
    update((current) => ({ ...current, articles: [article, ...current.articles] }));
    return { article, analyzed };
  }, [update]);

  const toggleArticleSaved = useCallback((id) => update((current) => ({
    ...current,
    articles: current.articles.map((article) => article.id === id ? { ...article, saved: !article.saved } : article),
  })), [update]);

  const updateProgress = useCallback((id, progress) => update((current) => {
    const plan = current.plans[todayKey] || seedState.plans[todayKey];
    return {
      ...current,
      articles: current.articles.map((article) => article.id === id ? { ...article, progress } : article),
      plans: { ...current.plans, [todayKey]: { ...plan, readingDone: progress >= 100 ? Math.max(1, plan.readingDone) : plan.readingDone } },
    };
  }), [update]);

  const addVocabulary = useCallback((wordData, articleId) => {
    let created;
    update((current) => {
      const existing = current.vocabulary.find((item) => item.word.toLowerCase() === wordData.word.toLowerCase());
      if (existing) {
        created = existing;
        return current;
      }
      created = {
        id: uid("vocab"),
        ...wordData,
        articleId,
        status: "new",
        repetition: 0,
        intervalDays: 1,
        easeFactor: 2.5,
        nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      const plan = current.plans[todayKey] || seedState.plans[todayKey];
      return { ...current, vocabulary: [created, ...current.vocabulary], plans: { ...current.plans, [todayKey]: { ...plan, wordDone: plan.wordDone + 1 } } };
    });
    return created;
  }, [update]);

  const removeVocabulary = useCallback((id) => update((current) => ({ ...current, vocabulary: current.vocabulary.filter((item) => item.id !== id) })), [update]);

  const recordReview = useCallback((id, result, responseMs) => update((current) => {
    const item = current.vocabulary.find((word) => word.id === id);
    if (!item) return current;
    const reviewed = reviewWord(item, result);
    const plan = current.plans[todayKey] || seedState.plans[todayKey];
    return {
      ...current,
      vocabulary: current.vocabulary.map((word) => word.id === id ? reviewed : word),
      reviewEvents: [{ id: uid("review"), vocabularyId: id, result, responseMs, reviewedAt: new Date().toISOString() }, ...current.reviewEvents],
      plans: { ...current.plans, [todayKey]: { ...plan, reviewDone: plan.reviewDone + 1 } },
    };
  }), [update]);

  const saveNote = useCallback((note) => update((current) => {
    const next = { ...note, id: note.id || uid("note"), updatedAt: new Date().toISOString() };
    const exists = current.notes.some((item) => item.id === next.id);
    return { ...current, notes: exists ? current.notes.map((item) => item.id === next.id ? next : item) : [next, ...current.notes] };
  }), [update]);

  const deleteNote = useCallback((id) => update((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) })), [update]);
  const updatePlan = useCallback((plan) => update((current) => ({ ...current, plans: { ...current.plans, [plan.date]: plan } })), [update]);
  const updateSettings = useCallback((settings) => update((current) => ({ ...current, settings: { ...current.settings, ...settings } })), [update]);
  const replaceFromCloud = useCallback((cloud) => update((current) => ({ ...current, ...cloud, settings: { ...current.settings, ...cloud.settings, ai: { ...current.settings.ai, ...cloud.settings?.ai } } })), [update]);

  const actions = useMemo(() => ({ addArticle, toggleArticleSaved, updateProgress, addVocabulary, removeVocabulary, recordReview, saveNote, deleteNote, updatePlan, updateSettings, replaceFromCloud }), [addArticle, toggleArticleSaved, updateProgress, addVocabulary, removeVocabulary, recordReview, saveNote, deleteNote, updatePlan, updateSettings, replaceFromCloud]);
  return { state, actions };
}
