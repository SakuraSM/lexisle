import { getLocalDateKey, getWeekDateKeys, shiftDateKey } from "./date.js";
import { calculateReaderProgress, createReaderData, mergeReaderData } from "./reader.js";

export const STATE_VERSION = 3;
export const STORAGE_KEY_V3 = "lexisle:data:v3";
export const STORAGE_KEY_V2 = "lexisle:data:v2";
export const STORAGE_KEY_V1 = "lexisle:data:v1";

const DEFAULT_REVIEW_TARGET = 8;

export function createDailyPlan(date, dailyGoal = 5, now = new Date()) {
  return {
    date,
    readingTarget: 1,
    wordTarget: dailyGoal,
    reviewTarget: DEFAULT_REVIEW_TARGET,
    readingDone: 0,
    wordDone: 0,
    reviewDone: 0,
    updatedAt: now.toISOString(),
  };
}

function withUpdatedAt(item, fallback) {
  return { ...item, updatedAt: item.updatedAt || item.createdAt || fallback };
}

function normalizeSettings(settings, defaults, fallbackIso) {
  return {
    ...defaults,
    ...settings,
    updatedAt: settings?.updatedAt || fallbackIso,
    ai: {
      ...defaults.ai,
      ...settings?.ai,
      rememberKey: Boolean(settings?.ai?.rememberKey),
    },
  };
}

export function migrateState(rawState, seedState, now = new Date()) {
  const nowIso = now.toISOString();
  const source = rawState && typeof rawState === "object" ? rawState : {};
  const dateKey = getLocalDateKey(now);
  const legacySettingsTime = source.version === 1 && source.lastStudyDate ? `${source.lastStudyDate}T00:00:00.000Z` : "";
  const settings = normalizeSettings(source.settings, seedState.settings, legacySettingsTime || seedState.settings.updatedAt || nowIso);
  const plans = Object.fromEntries(Object.entries(source.plans || seedState.plans || {}).map(([key, plan]) => [key, withUpdatedAt({ ...plan, date: key }, nowIso)]));
  if (!plans[dateKey]) plans[dateKey] = createDailyPlan(dateKey, settings.dailyGoal, now);

  return {
    ...seedState,
    ...source,
    version: STATE_VERSION,
    articles: (source.articles || seedState.articles || []).map((item) => {
      const article = withUpdatedAt(item, nowIso);
      return { ...article, readerData: createReaderData(article, article.readerData) };
    }),
    vocabulary: (source.vocabulary || seedState.vocabulary || []).map((item) => withUpdatedAt(item, nowIso)),
    notes: (source.notes || seedState.notes || []).map((item) => withUpdatedAt(item, nowIso)),
    reviewEvents: (source.reviewEvents || []).map((item) => withUpdatedAt(item, item.reviewedAt || nowIso)),
    plans,
    settings,
    tombstones: {
      articles: source.tombstones?.articles || [],
      vocabulary: source.tombstones?.vocabulary || [],
      notes: source.tombstones?.notes || [],
    },
  };
}

export function ensureDailyPlan(state, dateKey = getLocalDateKey(), now = new Date()) {
  if (state.plans[dateKey]) return state;
  return {
    ...state,
    plans: {
      ...state.plans,
      [dateKey]: createDailyPlan(dateKey, state.settings.dailyGoal, now),
    },
  };
}

export function hasPlanActivity(plan) {
  return Boolean(plan && (plan.readingDone > 0 || plan.wordDone > 0 || plan.reviewDone > 0));
}

export function calculateStreak(plans, today = getLocalDateKey()) {
  let cursor = hasPlanActivity(plans[today]) ? today : shiftDateKey(today, -1);
  let streak = 0;
  while (hasPlanActivity(plans[cursor])) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function getPlanScore(plan) {
  if (!plan) return 0;
  const targets = [
    [plan.readingDone, plan.readingTarget],
    [plan.wordDone, plan.wordTarget],
    [plan.reviewDone, plan.reviewTarget],
  ];
  return Math.round(targets.reduce((sum, [done, target]) => sum + Math.min(1, done / Math.max(1, target)), 0) / targets.length * 100);
}

export function calculateLearningReport(state, today = getLocalDateKey()) {
  const currentWeek = getWeekDateKeys(today);
  const previousWeek = currentWeek.map((date) => shiftDateKey(date, -7));
  const currentActivity = currentWeek.map((date) => getPlanScore(state.plans[date]));
  const previousActivity = previousWeek.map((date) => getPlanScore(state.plans[date]));
  const currentTotal = currentActivity.reduce((sum, value) => sum + value, 0);
  const previousTotal = previousActivity.reduce((sum, value) => sum + value, 0);
  const comparison = previousTotal ? Math.round((currentTotal - previousTotal) / previousTotal * 100) : null;
  const correct = state.reviewEvents.filter((event) => event.result === "good" || event.result === "easy").length;

  return {
    activity: currentActivity,
    comparison,
    accuracy: state.reviewEvents.length ? Math.round(correct / state.reviewEvents.length * 100) : null,
    streak: calculateStreak(state.plans, today),
  };
}

function recordTime(record) {
  return Date.parse(record?.updatedAt || record?.createdAt || 0) || 0;
}

function mergeRecords(localRecords = [], cloudRecords = [], mergeRecord) {
  const records = new Map(localRecords.map((record) => [record.id, record]));
  let downloaded = 0;
  let retained = 0;
  let conflicts = 0;

  for (const cloudRecord of cloudRecords) {
    const localRecord = records.get(cloudRecord.id);
    if (!localRecord) {
      records.set(cloudRecord.id, cloudRecord);
      downloaded += 1;
      continue;
    }
    if (recordTime(cloudRecord) === recordTime(localRecord)) {
      if (mergeRecord) records.set(cloudRecord.id, mergeRecord(localRecord, cloudRecord));
      continue;
    }
    conflicts += 1;
    if (recordTime(cloudRecord) > recordTime(localRecord)) {
      records.set(cloudRecord.id, mergeRecord ? mergeRecord(localRecord, cloudRecord) : { ...localRecord, ...cloudRecord });
      downloaded += 1;
    } else {
      if (mergeRecord) records.set(cloudRecord.id, mergeRecord(localRecord, cloudRecord));
      retained += 1;
    }
  }

  return { records: [...records.values()], summary: { downloaded, retained, conflicts } };
}

function mergePlans(localPlans = {}, cloudPlans = {}) {
  const result = { ...localPlans };
  let downloaded = 0;
  let retained = 0;
  let conflicts = 0;
  for (const [date, cloudPlan] of Object.entries(cloudPlans)) {
    const localPlan = result[date];
    if (!localPlan || recordTime(cloudPlan) > recordTime(localPlan)) {
      if (localPlan) conflicts += 1;
      result[date] = cloudPlan;
      downloaded += 1;
    } else if (recordTime(cloudPlan) < recordTime(localPlan)) {
      conflicts += 1;
      retained += 1;
    }
  }
  return { records: result, summary: { downloaded, retained, conflicts } };
}

function applyTombstones(records, tombstones) {
  const deleted = new Map(tombstones.map((item) => [item.id, item]));
  return records.filter((record) => recordTime(deleted.get(record.id)) < recordTime(record));
}

function addSummaries(target, summary) {
  target.downloaded += summary.downloaded;
  target.retained += summary.retained;
  target.conflicts += summary.conflicts;
}

export function mergeCloudState(localState, cloudState) {
  const summary = { downloaded: 0, retained: 0, conflicts: 0 };
  const articles = mergeRecords(localState.articles, cloudState.articles, (localArticle, cloudArticle) => {
    const cloudIsNewer = recordTime(cloudArticle) > recordTime(localArticle);
    const article = cloudIsNewer ? { ...localArticle, ...cloudArticle } : { ...cloudArticle, ...localArticle };
    article.readerData = mergeReaderData(localArticle.readerData, cloudArticle.readerData, article);
    article.progress = Math.max(localArticle.progress || 0, cloudArticle.progress || 0, calculateReaderProgress(article.readerData));
    return article;
  });
  const vocabulary = mergeRecords(localState.vocabulary, cloudState.vocabulary);
  const notes = mergeRecords(localState.notes, cloudState.notes);
  const events = mergeRecords(localState.reviewEvents, cloudState.reviewEvents);
  const plans = mergePlans(localState.plans, cloudState.plans);
  const articleTombstones = mergeRecords(localState.tombstones.articles, cloudState.tombstones?.articles);
  const vocabularyTombstones = mergeRecords(localState.tombstones.vocabulary, cloudState.tombstones?.vocabulary);
  const noteTombstones = mergeRecords(localState.tombstones.notes, cloudState.tombstones?.notes);
  [articles, vocabulary, notes, events, plans, articleTombstones, vocabularyTombstones, noteTombstones].forEach((result) => addSummaries(summary, result.summary));

  const localSettingsTime = recordTime(localState.settings);
  const cloudSettingsTime = recordTime(cloudState.settings);
  const cloudSettingsWin = cloudState.settings && cloudSettingsTime > localSettingsTime;
  if (cloudState.settings && cloudSettingsTime !== localSettingsTime) {
    summary.conflicts += 1;
    summary[cloudSettingsWin ? "downloaded" : "retained"] += 1;
  }
  const settings = cloudSettingsWin ? {
    ...localState.settings,
    ...cloudState.settings,
    ai: {
      ...localState.settings.ai,
      ...cloudState.settings.ai,
      rememberKey: localState.settings.ai.rememberKey,
    },
  } : localState.settings;

  return {
    state: {
      ...localState,
      articles: applyTombstones(articles.records, articleTombstones.records),
      vocabulary: applyTombstones(vocabulary.records, vocabularyTombstones.records),
      notes: applyTombstones(notes.records, noteTombstones.records),
      reviewEvents: events.records,
      plans: plans.records,
      settings,
      tombstones: {
        articles: articleTombstones.records,
        vocabulary: vocabularyTombstones.records,
        notes: noteTombstones.records,
      },
    },
    summary,
  };
}
