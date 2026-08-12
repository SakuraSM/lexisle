export const REQUIRED_COLLECTIONS = ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"];

function isMissingCollection(error) {
  return error?.status === 404 || error?.response?.code === 404;
}

function escapeFilter(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function listCollection(pb, collection, userId) {
  try {
    const records = await pb.collection(collection).getFullList({ filter: `user = "${escapeFilter(userId)}"` });
    return { collection, records };
  } catch (error) {
    return { collection, error, unavailable: isMissingCollection(error) };
  }
}

function mapArticle(article) {
  return {
    id: article.client_id || article.id,
    cloudId: article.id,
    title: article.title,
    source: article.source,
    topic: article.topic,
    url: article.url,
    image: article.image || "/assets/deep-sleep-bedroom.webp",
    difficulty: article.difficulty,
    createdAt: article.created,
    updatedAt: article.updated,
    saved: article.saved,
    progress: article.progress,
    text: article.text,
    analysis: Array.isArray(article.analysis_json) ? article.analysis_json : undefined,
    readerData: article.reader_json && typeof article.reader_json === "object" ? article.reader_json : undefined,
    deletedAt: article.deleted_at || "",
  };
}

function mapVocabulary(item) {
  return {
    id: item.client_id || item.id,
    cloudId: item.id,
    word: item.word,
    phonetic: item.phonetic,
    part: item.part || "",
    definition: item.definition_zh,
    example: item.context,
    articleId: item.article_id || "",
    status: item.status,
    nextReviewAt: item.next_review_at,
    repetition: item.repetition,
    intervalDays: item.interval_days,
    easeFactor: item.ease_factor,
    createdAt: item.created,
    updatedAt: item.updated,
    deletedAt: item.deleted_at || "",
  };
}

function mapNote(note) {
  return {
    id: note.client_id || note.id,
    cloudId: note.id,
    articleId: note.article_id,
    title: note.title,
    body: note.body,
    tags: note.tags || [],
    updatedAt: note.updated,
    deletedAt: note.deleted_at || "",
  };
}

function splitDeleted(records, mapper) {
  const active = [];
  const deleted = [];
  for (const raw of records) {
    const item = mapper(raw);
    (item.deletedAt ? deleted : active).push(item);
  }
  return { active, deleted };
}

function toCloudState(recordsByCollection) {
  const articles = splitDeleted(recordsByCollection.articles || [], mapArticle);
  const vocabulary = splitDeleted(recordsByCollection.vocabulary_items || [], mapVocabulary);
  const notes = splitDeleted(recordsByCollection.notes || [], mapNote);
  const plans = Object.fromEntries((recordsByCollection.daily_plans || []).map((plan) => [plan.date, {
    date: plan.date,
    readingTarget: plan.reading_target,
    wordTarget: plan.word_target,
    reviewTarget: plan.review_target,
    readingDone: plan.reading_done,
    wordDone: plan.word_done,
    reviewDone: plan.review_done,
    updatedAt: plan.updated,
  }]));
  const reviewEvents = (recordsByCollection.review_events || []).map((event) => ({
    id: event.client_id || event.id,
    cloudId: event.id,
    vocabularyId: event.vocabulary_client_id || "",
    result: event.result,
    reviewedAt: event.reviewed_at,
    responseMs: event.response_ms,
    updatedAt: event.updated,
  }));
  const rawSettings = recordsByCollection.user_settings?.[0];
  const settings = rawSettings ? {
    dailyGoal: rawSettings.daily_goal,
    reminderTime: rawSettings.reminder_time,
    notifications: rawSettings.notifications,
    autoSaveWords: rawSettings.auto_save_words,
    difficulty: rawSettings.difficulty,
    ai: {
      enabled: rawSettings.ai_enabled,
      endpoint: rawSettings.ai_endpoint,
      model: rawSettings.ai_model,
      maxWords: rawSettings.ai_max_words,
      prompt: rawSettings.ai_prompt,
    },
    updatedAt: rawSettings.updated,
  } : undefined;

  return {
    articles: articles.active,
    vocabulary: vocabulary.active,
    notes: notes.active,
    plans,
    reviewEvents,
    settings,
    tombstones: {
      articles: articles.deleted,
      vocabulary: vocabulary.deleted,
      notes: notes.deleted,
    },
  };
}

export async function loadCloudData(pb, userId) {
  const results = await Promise.all(REQUIRED_COLLECTIONS.map((name) => listCollection(pb, name, userId)));
  const failedCollections = results.filter((result) => result.error).map((result) => result.collection);
  const unavailableCollections = results.filter((result) => result.unavailable).map((result) => result.collection);
  const errors = Object.fromEntries(results.filter((result) => result.error).map((result) => [result.collection, result.error?.message || "同步读取失败"]));
  const recordsByCollection = Object.fromEntries(results.filter((result) => result.records).map((result) => [result.collection, result.records]));
  const loaded = results.reduce((sum, result) => sum + (result.records?.length || 0), 0);
  const status = unavailableCollections.length ? "unavailable" : failedCollections.length ? "partial" : "ok";

  return {
    status,
    loaded,
    failedCollections,
    unavailableCollections,
    errors,
    data: toCloudState(recordsByCollection),
  };
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

async function saveGroup(collection, jobs) {
  const results = await Promise.allSettled(jobs);
  return {
    collection,
    saved: results.filter((result) => result.status === "fulfilled").length,
    errors: results.filter((result) => result.status === "rejected").map((result) => result.reason),
  };
}

function articlePayload(userId, article) {
  return {
    user: userId,
    client_id: article.id,
    title: article.title,
    source: article.source,
    topic: article.topic,
    url: article.url,
    image: article.image,
    difficulty: article.difficulty,
    saved: article.saved,
    progress: article.progress,
    text: article.text,
    analysis_json: article.analysis || [],
    reader_json: article.readerData || {},
    deleted_at: article.deletedAt || "",
  };
}

function vocabularyPayload(userId, item) {
  return {
    user: userId,
    client_id: item.id,
    word: item.word,
    phonetic: item.phonetic,
    part: item.part,
    definition_zh: item.definition,
    context: item.example,
    article_id: item.articleId,
    status: item.status,
    next_review_at: item.nextReviewAt,
    repetition: item.repetition,
    interval_days: item.intervalDays,
    ease_factor: item.easeFactor,
    deleted_at: item.deletedAt || "",
  };
}

function notePayload(userId, note) {
  return {
    user: userId,
    client_id: note.id,
    article_id: note.articleId,
    title: note.title,
    body: note.body,
    tags: note.tags,
    deleted_at: note.deletedAt || "",
  };
}

export async function saveCloudData(pb, userId, state) {
  const byCollection = {
    articles: [...state.articles, ...state.tombstones.articles].map((article) => upsert(pb, "articles", `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(article.id)}"`, articlePayload(userId, article))),
    vocabulary_items: [...state.vocabulary, ...state.tombstones.vocabulary].map((item) => upsert(pb, "vocabulary_items", `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(item.id)}"`, vocabularyPayload(userId, item))),
    daily_plans: Object.values(state.plans).map((plan) => upsert(pb, "daily_plans", `user = "${escapeFilter(userId)}" && date = "${escapeFilter(plan.date)}"`, {
      user: userId,
      date: plan.date,
      reading_target: plan.readingTarget,
      word_target: plan.wordTarget,
      review_target: plan.reviewTarget,
      reading_done: plan.readingDone,
      word_done: plan.wordDone,
      review_done: plan.reviewDone,
    })),
    review_events: state.reviewEvents.map((event) => upsert(pb, "review_events", `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(event.id)}"`, {
      user: userId,
      client_id: event.id,
      vocabulary_client_id: event.vocabularyId,
      result: event.result,
      reviewed_at: event.reviewedAt,
      response_ms: event.responseMs,
    })),
    notes: [...state.notes, ...state.tombstones.notes].map((note) => upsert(pb, "notes", `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(note.id)}"`, notePayload(userId, note))),
    user_settings: [upsert(pb, "user_settings", `user = "${escapeFilter(userId)}"`, {
      user: userId,
      daily_goal: state.settings.dailyGoal,
      reminder_time: state.settings.reminderTime,
      notifications: state.settings.notifications,
      auto_save_words: state.settings.autoSaveWords,
      difficulty: state.settings.difficulty,
      ai_enabled: state.settings.ai.enabled,
      ai_endpoint: state.settings.ai.endpoint,
      ai_model: state.settings.ai.model,
      ai_max_words: state.settings.ai.maxWords,
      ai_prompt: state.settings.ai.prompt,
    })],
  };

  const groups = await Promise.all(Object.entries(byCollection).map(([collection, jobs]) => saveGroup(collection, jobs)));
  const failedCollections = groups.filter((group) => group.errors.length).map((group) => group.collection);
  const unavailableCollections = groups.filter((group) => group.errors.some(isMissingCollection)).map((group) => group.collection);
  const saved = groups.reduce((sum, group) => sum + group.saved, 0);
  const status = unavailableCollections.length ? "unavailable" : failedCollections.length ? "partial" : "ok";

  return { status, saved, failedCollections, unavailableCollections };
}
