export const REQUIRED_COLLECTIONS = ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"];

function isMissingCollection(error) {
  return error?.status === 404 || error?.response?.code === 404;
}

function escapeFilter(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function cursorFilter(cursor) {
  if (!cursor?.updated) return "";
  const updated = escapeFilter(cursor.updated);
  const id = escapeFilter(cursor.id || "");
  return ` && (updated > "${updated}" || (updated = "${updated}" && id > "${id}"))`;
}

async function listCollection(pb, collection, userId, cursor) {
  try {
    const records = await pb.collection(collection).getFullList({
      filter: `user = "${escapeFilter(userId)}"${cursorFilter(cursor)}`,
      sort: "updated,id",
    });
    return { collection, records, cursor };
  } catch (error) {
    return { collection, error, unavailable: isMissingCollection(error), cursor };
  }
}

function nextCursor(result, syncStartedAt) {
  if (result.error) return result.cursor;
  const latest = result.records?.at(-1);
  if (latest?.updated) return { updated: latest.updated, id: latest.id || "" };
  return result.cursor || { updated: syncStartedAt, id: "" };
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
    updatedAt: article.client_updated_at || article.updated,
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
    updatedAt: item.client_updated_at || item.updated,
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
    updatedAt: note.client_updated_at || note.updated,
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
    updatedAt: plan.client_updated_at || plan.updated,
  }]));
  const reviewEvents = (recordsByCollection.review_events || []).map((event) => ({
    id: event.client_id || event.id,
    cloudId: event.id,
    vocabularyId: event.vocabulary_client_id || "",
    result: event.result,
    reviewedAt: event.reviewed_at,
    responseMs: event.response_ms,
    updatedAt: event.client_updated_at || event.updated,
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
      keyConfigured: false,
    },
    updatedAt: rawSettings.client_updated_at || rawSettings.updated,
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

export async function loadCloudData(pb, userId, { cursors = {} } = {}) {
  const syncStartedAt = new Date().toISOString();
  const results = await Promise.all(REQUIRED_COLLECTIONS.map((name) => listCollection(pb, name, userId, cursors[name])));
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
    cursors: Object.fromEntries(results.map((result) => [result.collection, nextCursor(result, syncStartedAt)]).filter(([, cursor]) => cursor)),
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
    acknowledgedKeys: results.filter((result) => result.status === "fulfilled").map((result) => result.value.storageKey),
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
    client_updated_at: article.updatedAt,
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
    client_updated_at: item.updatedAt,
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
    client_updated_at: note.updatedAt,
  };
}

export async function saveCloudData(pb, userId, state) {
  return saveCloudChanges(pb, userId, state, buildAllSyncEntries(state));
}

function buildAllSyncEntries(state) {
  return [
    ...state.articles.map((item) => ({ storageKey: `articles:${item.id}`, collection: "articles", entityKey: item.id })),
    ...state.vocabulary.map((item) => ({ storageKey: `vocabulary:${item.id}`, collection: "vocabulary", entityKey: item.id })),
    ...Object.values(state.plans).map((item) => ({ storageKey: `dailyPlans:${item.date}`, collection: "dailyPlans", entityKey: item.date })),
    ...state.reviewEvents.map((item) => ({ storageKey: `reviewEvents:${item.id}`, collection: "reviewEvents", entityKey: item.id })),
    ...state.notes.map((item) => ({ storageKey: `notes:${item.id}`, collection: "notes", entityKey: item.id })),
    ...Object.entries(state.tombstones).flatMap(([kind, items]) => items.map((item) => ({ storageKey: `tombstones:${kind}:${item.id}`, collection: "tombstones", entityKey: `${kind}:${item.id}` }))),
    { storageKey: "settings:current", collection: "settings", entityKey: "current" },
  ];
}

function findEntity(state, entry) {
  if (entry.collection === "articles") return state.articles.find((item) => item.id === entry.entityKey);
  if (entry.collection === "vocabulary") return state.vocabulary.find((item) => item.id === entry.entityKey);
  if (entry.collection === "dailyPlans") return state.plans[entry.entityKey];
  if (entry.collection === "reviewEvents") return state.reviewEvents.find((item) => item.id === entry.entityKey);
  if (entry.collection === "notes") return state.notes.find((item) => item.id === entry.entityKey);
  if (entry.collection === "settings") return state.settings;
  if (entry.collection !== "tombstones") return null;
  const separatorIndex = entry.entityKey.indexOf(":");
  const kind = entry.entityKey.slice(0, separatorIndex);
  const entityId = entry.entityKey.slice(separatorIndex + 1);
  return state.tombstones[kind]?.find((item) => item.id === entityId) || null;
}

function createCloudJob(pb, userId, state, entry) {
  const entity = findEntity(state, entry);
  if (!entity) return null;
  let collection;
  let filter;
  let payload;

  if (entry.collection === "articles" || entry.entityKey.startsWith("articles:")) {
    collection = "articles";
    filter = `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(entity.id)}"`;
    payload = articlePayload(userId, entity);
  } else if (entry.collection === "vocabulary" || entry.entityKey.startsWith("vocabulary:")) {
    collection = "vocabulary_items";
    filter = `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(entity.id)}"`;
    payload = vocabularyPayload(userId, entity);
  } else if (entry.collection === "notes" || entry.entityKey.startsWith("notes:")) {
    collection = "notes";
    filter = `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(entity.id)}"`;
    payload = notePayload(userId, entity);
  } else if (entry.collection === "dailyPlans") {
    collection = "daily_plans";
    filter = `user = "${escapeFilter(userId)}" && date = "${escapeFilter(entity.date)}"`;
    payload = {
      user: userId,
      date: entity.date,
      reading_target: entity.readingTarget,
      word_target: entity.wordTarget,
      review_target: entity.reviewTarget,
      reading_done: entity.readingDone,
      word_done: entity.wordDone,
      review_done: entity.reviewDone,
      client_updated_at: entity.updatedAt,
    };
  } else if (entry.collection === "reviewEvents") {
    collection = "review_events";
    filter = `user = "${escapeFilter(userId)}" && client_id = "${escapeFilter(entity.id)}"`;
    payload = {
      user: userId,
      client_id: entity.id,
      vocabulary_client_id: entity.vocabularyId,
      result: entity.result,
      reviewed_at: entity.reviewedAt,
      response_ms: entity.responseMs,
      client_updated_at: entity.updatedAt,
    };
  } else if (entry.collection === "settings") {
    collection = "user_settings";
    filter = `user = "${escapeFilter(userId)}"`;
    payload = {
      user: userId,
      daily_goal: entity.dailyGoal,
      reminder_time: entity.reminderTime,
      notifications: entity.notifications,
      auto_save_words: entity.autoSaveWords,
      difficulty: entity.difficulty,
      client_updated_at: entity.updatedAt,
    };
  } else {
    return null;
  }

  return {
    collection,
    promise: upsert(pb, collection, filter, payload).then(() => ({ storageKey: entry.storageKey })),
  };
}

export async function saveCloudChanges(pb, userId, state, pendingEntries) {
  const jobs = pendingEntries.map((entry) => createCloudJob(pb, userId, state, entry)).filter(Boolean);
  if (!jobs.length) return { status: "ok", saved: 0, failedCollections: [], unavailableCollections: [], acknowledgedKeys: [] };

  const groupedJobs = jobs.reduce((groups, job) => {
    groups[job.collection] ||= [];
    groups[job.collection].push(job);
    return groups;
  }, {});
  const byCollection = Object.entries(groupedJobs).map(([collection, collectionJobs]) => saveGroup(collection, collectionJobs.map((job) => job.promise)));

  const groups = await Promise.all(byCollection);
  const failedCollections = groups.filter((group) => group.errors.length).map((group) => group.collection);
  const unavailableCollections = groups.filter((group) => group.errors.some(isMissingCollection)).map((group) => group.collection);
  const saved = groups.reduce((sum, group) => sum + group.saved, 0);
  const acknowledgedKeys = groups.flatMap((group) => group.acknowledgedKeys);
  const status = unavailableCollections.length ? "unavailable" : failedCollections.length ? "partial" : "ok";

  return { status, saved, failedCollections, unavailableCollections, acknowledgedKeys };
}
