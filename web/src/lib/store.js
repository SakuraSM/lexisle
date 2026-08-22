import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedState } from "../data/seed.js";
import { getLocalDateKey } from "./date.js";
import { analyzeText, reviewWord } from "./learning.js";
import {
  acknowledgeSyncEntries,
  hydrateLocalState,
  listPendingSyncEntries,
  persistLocalChanges,
  readCloudSyncCursors,
  writeCloudSyncCursors,
} from "./localRepository.js";
import { calculateReaderProgress, createReaderData } from "./reader.js";
import { createDailyPlan, ensureDailyPlan, migrateState } from "./stateModel.js";

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function updateTodayPlan(state, recipe, now = new Date()) {
  const date = getLocalDateKey(now);
  const current = ensureDailyPlan(state, date, now);
  const plan = current.plans[date] || createDailyPlan(date, current.settings.dailyGoal, now);
  return {
    ...current,
    plans: {
      ...current.plans,
      [date]: { ...recipe(plan), updatedAt: now.toISOString() },
    },
  };
}

function addTombstone(state, kind, record, now = new Date()) {
  if (!record) return state;
  const tombstone = { ...record, deletedAt: now.toISOString(), updatedAt: now.toISOString() };
  return {
    ...state,
    tombstones: {
      ...state.tombstones,
      [kind]: [tombstone, ...state.tombstones[kind].filter((item) => item.id !== record.id)],
    },
  };
}

export function useLexisleStore() {
  const [state, setState] = useState(() => migrateState(null, seedState));
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState({ kind: "loading", message: "正在读取本地学习数据" });
  const lastQueuedStateRef = useRef(state);
  const commitQueueRef = useRef(Promise.resolve());

  const queuePersistence = useCallback((previousState, nextState, shouldEnqueueSync) => {
    lastQueuedStateRef.current = nextState;
    setPersistenceStatus({ kind: "saving", message: "正在保存本地数据" });
    commitQueueRef.current = commitQueueRef.current
      .catch(() => {})
      .then(() => persistLocalChanges({ previousState, nextState, shouldEnqueueSync }))
      .then(() => setPersistenceStatus({ kind: "ready", message: "本地数据已保存" }))
      .catch((error) => {
        setPersistenceStatus({ kind: "error", message: error?.message || "本地保存失败" });
        throw error;
      });
    return commitQueueRef.current;
  }, []);

  useEffect(() => {
    let isCancelled = false;
    hydrateLocalState({ migrateState, seedState }).then((hydratedState) => {
      if (isCancelled) return;
      lastQueuedStateRef.current = hydratedState;
      setState(hydratedState);
      setIsHydrated(true);
      setPersistenceStatus({ kind: "ready", message: "本地数据已载入" });
    }).catch((error) => {
      if (isCancelled) return;
      setIsHydrated(true);
      setPersistenceStatus({ kind: "error", message: error?.message || "无法读取本地学习数据" });
    });
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    if (!isHydrated || state === lastQueuedStateRef.current) return;
    const previousState = lastQueuedStateRef.current;
    const nextState = state;
    queuePersistence(previousState, nextState, true).catch(() => {});
  }, [isHydrated, queuePersistence, state]);

  const update = useCallback((recipe) => {
    setState((current) => recipe(current));
  }, []);

  const replaceState = useCallback((nextState) => {
    const migratedState = migrateState(nextState, seedState);
    const commit = queuePersistence(lastQueuedStateRef.current, migratedState, false);
    setState(migratedState);
    return commit;
  }, [queuePersistence]);

  const ensureToday = useCallback((date = getLocalDateKey()) => {
    update((current) => ensureDailyPlan(current, date));
  }, [update]);

  const addArticle = useCallback(({ title, source, url, text, difficulty, analysis }) => {
    const id = uid("article");
    const now = new Date();
    const article = {
      id,
      title: title.trim() || "未命名英文文章",
      source: source || (url ? new URL(url).hostname.replace(/^www\./, "") : "手动粘贴"),
      topic: "自定义阅读",
      url: url || `local://${id}`,
      image: "/assets/deep-sleep-bedroom.webp",
      difficulty,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      saved: false,
      progress: 0,
      text: text.trim(),
      analysis: analysis?.length ? analysis : undefined,
    };
    article.readerData = createReaderData(article);
    const analyzed = article.analysis || analyzeText(article.text);
    update((current) => ({ ...current, articles: [article, ...current.articles] }));
    return { article, analyzed };
  }, [update]);

  const toggleArticleSaved = useCallback((id) => update((current) => {
    const updatedAt = new Date().toISOString();
    return {
      ...current,
      articles: current.articles.map((article) => article.id === id ? { ...article, saved: !article.saved, updatedAt } : article),
    };
  }), [update]);

  const updateProgress = useCallback((id, progress) => update((current) => {
    const now = new Date();
    const wasComplete = current.articles.find((article) => article.id === id)?.progress >= 100;
    const next = {
      ...current,
      articles: current.articles.map((article) => article.id === id ? { ...article, progress, readerData: { ...article.readerData, freeProgress: Math.max(article.readerData?.freeProgress || 0, progress), updatedAt: now.toISOString() }, updatedAt: now.toISOString() } : article),
    };
    if (progress < 100 || wasComplete) return ensureDailyPlan(next, getLocalDateKey(now), now);
    return updateTodayPlan(next, (plan) => ({ ...plan, readingDone: plan.readingDone + 1 }), now);
  }), [update]);

  const updateReaderProgress = useCallback((id, readerPatch) => update((current) => {
    const now = new Date();
    const currentArticle = current.articles.find((article) => article.id === id);
    if (!currentArticle) return current;
    const readerData = createReaderData(currentArticle, { ...currentArticle.readerData, ...readerPatch, updatedAt: now.toISOString() });
    const progress = Math.max(currentArticle.progress || 0, calculateReaderProgress(readerData));
    const wasComplete = currentArticle.progress >= 100;
    const next = {
      ...current,
      articles: current.articles.map((article) => article.id === id ? { ...article, readerData, progress, updatedAt: now.toISOString() } : article),
    };
    if (progress < 100 || wasComplete) return ensureDailyPlan(next, getLocalDateKey(now), now);
    return updateTodayPlan(next, (plan) => ({ ...plan, readingDone: plan.readingDone + 1 }), now);
  }), [update]);

  const addVocabulary = useCallback((wordData, articleId) => {
    let created;
    update((current) => {
      const existing = current.vocabulary.find((item) => item.word.toLowerCase() === wordData.word.toLowerCase());
      if (existing) {
        created = existing;
        return current;
      }
      const now = new Date();
      created = {
        id: uid("vocab"),
        ...wordData,
        articleId,
        status: "new",
        repetition: 0,
        intervalDays: 1,
        easeFactor: 2.5,
        nextReviewAt: new Date(now.getTime() + 86400000).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      return updateTodayPlan({ ...current, vocabulary: [created, ...current.vocabulary] }, (plan) => ({ ...plan, wordDone: plan.wordDone + 1 }), now);
    });
    return created;
  }, [update]);

  const removeVocabulary = useCallback((id) => update((current) => {
    const record = current.vocabulary.find((item) => item.id === id);
    return addTombstone({ ...current, vocabulary: current.vocabulary.filter((item) => item.id !== id) }, "vocabulary", record);
  }), [update]);

  const deleteArticle = useCallback((id) => update((current) => {
    const record = current.articles.find((item) => item.id === id);
    return addTombstone({ ...current, articles: current.articles.filter((item) => item.id !== id) }, "articles", record);
  }), [update]);

  const recordReview = useCallback((id, result, responseMs) => update((current) => {
    const item = current.vocabulary.find((word) => word.id === id);
    if (!item) return current;
    const now = new Date();
    const reviewed = { ...reviewWord(item, result, now), updatedAt: now.toISOString() };
    const event = { id: uid("review"), vocabularyId: id, result, responseMs, reviewedAt: now.toISOString(), updatedAt: now.toISOString() };
    return updateTodayPlan({
      ...current,
      vocabulary: current.vocabulary.map((word) => word.id === id ? reviewed : word),
      reviewEvents: [event, ...current.reviewEvents],
    }, (plan) => ({ ...plan, reviewDone: plan.reviewDone + 1 }), now);
  }), [update]);

  const saveNote = useCallback((note) => update((current) => {
    const next = { ...note, id: note.id || uid("note"), updatedAt: new Date().toISOString() };
    const exists = current.notes.some((item) => item.id === next.id);
    return { ...current, notes: exists ? current.notes.map((item) => item.id === next.id ? next : item) : [next, ...current.notes] };
  }), [update]);

  const deleteNote = useCallback((id) => update((current) => {
    const record = current.notes.find((note) => note.id === id);
    return addTombstone({ ...current, notes: current.notes.filter((note) => note.id !== id) }, "notes", record);
  }), [update]);

  const updatePlan = useCallback((plan) => update((current) => ({
    ...current,
    plans: { ...current.plans, [plan.date]: { ...plan, updatedAt: new Date().toISOString() } },
  })), [update]);

  const updateSettings = useCallback((settings) => update((current) => ({
    ...current,
    settings: {
      ...current.settings,
      ...settings,
      ai: { ...current.settings.ai, ...settings.ai },
      updatedAt: new Date().toISOString(),
    },
  })), [update]);

  const actions = useMemo(() => ({
    addArticle,
    addVocabulary,
    deleteArticle,
    deleteNote,
    ensureToday,
    recordReview,
    removeVocabulary,
    replaceState,
    saveNote,
    toggleArticleSaved,
    updatePlan,
    updateProgress,
    updateReaderProgress,
    updateSettings,
  }), [addArticle, addVocabulary, deleteArticle, deleteNote, ensureToday, recordReview, removeVocabulary, replaceState, saveNote, toggleArticleSaved, updatePlan, updateProgress, updateReaderProgress, updateSettings]);

  const storage = useMemo(() => ({
    acknowledgeSyncEntries,
    flushPersistence: () => commitQueueRef.current,
    listPendingSyncEntries,
    readCloudSyncCursors,
    writeCloudSyncCursors,
  }), []);

  return { state, actions, storage, isHydrated, persistenceStatus };
}
