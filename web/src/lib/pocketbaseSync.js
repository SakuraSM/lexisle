import { todayKey } from "../data/seed.js";

const COLLECTIONS = ["vocabulary_items", "reading_progress", "daily_plans", "review_events", "notes", "articles", "user_settings"];

function isMissingCollection(error) {
  return error?.status === 404 || error?.response?.code === 404;
}

async function safeList(pb, collection, userId) {
  try {
    return await pb.collection(collection).getFullList({ filter: `user = "${userId}"`, sort: "-updated" });
  } catch (error) {
    if (isMissingCollection(error)) return [];
    throw error;
  }
}

export async function loadCloudData(pb, userId) {
  const [vocab, progress, plans, events, notes, articles, settings] = await Promise.all(COLLECTIONS.map((name) => safeList(pb, name, userId)));
  const cloud = {};
  if (vocab.length) cloud.vocabulary = vocab.map((item) => ({ id: item.id, word: item.word, phonetic: item.phonetic, part: item.part || "", definition: item.definition_zh, example: item.context, articleId: item.article_id || "", status: item.status, nextReviewAt: item.next_review_at, repetition: item.repetition, intervalDays: item.interval_days, easeFactor: item.ease_factor, createdAt: item.created }));
  if (progress.length) cloud.articlesProgress = progress;
  if (plans.length) cloud.plans = Object.fromEntries(plans.map((plan) => [plan.date.slice(0, 10), { date: plan.date.slice(0, 10), readingTarget: plan.reading_target, wordTarget: plan.word_target, reviewTarget: plan.review_target, readingDone: plan.reading_done, wordDone: plan.word_done, reviewDone: plan.review_done }]));
  if (events.length) cloud.reviewEvents = events.map((event) => ({ id: event.client_id || event.id, cloudId: event.id, vocabularyId: event.vocabulary_item, result: event.result, reviewedAt: event.reviewed_at, responseMs: event.response_ms }));
  if (notes.length) cloud.notes = notes.map((note) => ({ id: note.client_id || note.id, cloudId: note.id, articleId: note.article_id, title: note.title, body: note.body, tags: note.tags || [], updatedAt: note.updated }));
  if (articles.length) cloud.articles = articles.map((article) => ({ id: article.client_id || article.id, cloudId: article.id, title: article.title, source: article.source, topic: article.topic, url: article.url, image: article.image || "/assets/deep-sleep-bedroom.png", difficulty: article.difficulty, createdAt: article.created, saved: article.saved, progress: article.progress, text: article.text }));
  if (settings[0]) cloud.settings = { dailyGoal: settings[0].daily_goal, reminderTime: settings[0].reminder_time, notifications: settings[0].notifications, autoSaveWords: settings[0].auto_save_words, difficulty: settings[0].difficulty, theme: settings[0].theme };
  return cloud;
}

async function upsert(pb, collection, filter, payload) {
  try {
    const existing = await pb.collection(collection).getFirstListItem(filter);
    return await pb.collection(collection).update(existing.id, payload);
  } catch (error) {
    if (error?.status !== 404) throw error;
    return pb.collection(collection).create(payload);
  }
}

export async function saveCloudData(pb, userId, state) {
  const tasks = [];
  const vocabularyResults = await Promise.allSettled(state.vocabulary.map((item) => upsert(pb, "vocabulary_items", `user = "${userId}" && word = "${item.word.replaceAll('"', '\\"')}"`, { user: userId, word: item.word, phonetic: item.phonetic, part: item.part, definition_zh: item.definition, context: item.example, article_id: item.articleId, status: item.status, next_review_at: item.nextReviewAt, repetition: item.repetition, interval_days: item.intervalDays, ease_factor: item.easeFactor })));
  const vocabularyIds = new Map();
  vocabularyResults.forEach((result, index) => {
    if (result.status === "fulfilled") vocabularyIds.set(state.vocabulary[index].id, result.value.id);
  });
  for (const article of state.articles) {
    tasks.push(upsert(pb, "reading_progress", `user = "${userId}" && article_url = "${article.url.replaceAll('"', '\\"')}"`, { user: userId, article_url: article.url, article_title: article.title, progress: article.progress, last_position: String(article.progress), saved_for_later: article.saved }));
  }
  const plan = state.plans[todayKey];
  if (plan) tasks.push(upsert(pb, "daily_plans", `user = "${userId}" && date >= "${todayKey} 00:00:00" && date <= "${todayKey} 23:59:59"`, { user: userId, date: `${todayKey} 00:00:00.000Z`, reading_target: plan.readingTarget, word_target: plan.wordTarget, review_target: plan.reviewTarget, reading_done: plan.readingDone, word_done: plan.wordDone, review_done: plan.reviewDone }));
  for (const event of state.reviewEvents) {
    const vocabularyItem = vocabularyIds.get(event.vocabularyId) || event.vocabularyId;
    tasks.push(upsert(pb, "review_events", `user = "${userId}" && client_id = "${event.id}"`, { user: userId, client_id: event.id, vocabulary_item: vocabularyItem, result: event.result, reviewed_at: event.reviewedAt, response_ms: event.responseMs }));
  }
  for (const article of state.articles) {
    tasks.push(upsert(pb, "articles", `user = "${userId}" && client_id = "${article.id}"`, { user: userId, client_id: article.id, title: article.title, source: article.source, topic: article.topic, url: article.url, image: article.image, difficulty: article.difficulty, saved: article.saved, progress: article.progress, text: article.text }));
  }
  for (const note of state.notes) {
    tasks.push(upsert(pb, "notes", `user = "${userId}" && client_id = "${note.id}"`, { user: userId, client_id: note.id, article_id: note.articleId, title: note.title, body: note.body, tags: note.tags }));
  }
  tasks.push(upsert(pb, "user_settings", `user = "${userId}"`, { user: userId, daily_goal: state.settings.dailyGoal, reminder_time: state.settings.reminderTime, notifications: state.settings.notifications, auto_save_words: state.settings.autoSaveWords, difficulty: state.settings.difficulty, theme: state.settings.theme }));
  const results = await Promise.allSettled(tasks);
  const allResults = [...vocabularyResults, ...results];
  const failures = allResults.filter((result) => result.status === "rejected" && !isMissingCollection(result.reason));
  if (failures.length) throw failures[0].reason;
  return { saved: allResults.filter((result) => result.status === "fulfilled").length, collections: COLLECTIONS };
}
