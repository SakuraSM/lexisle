import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL || "https://pocket.nings.top";
const superuserToken = process.env.POCKETBASE_SUPERUSER_TOKEN || process.env.token;

if (!superuserToken) throw new Error("缺少 PocketBase Superuser Token。请设置 POCKETBASE_SUPERUSER_TOKEN 或 token。");

const pocketBase = new PocketBase(POCKETBASE_URL);
pocketBase.autoCancellation(false);
pocketBase.authStore.save(superuserToken);

if (!pocketBase.authStore.isSuperuser) throw new Error("提供的 Token 不是 PocketBase Superuser Token。");

const ownerRule = "@request.auth.id != '' && user = @request.auth.id";

function relationToUsers(usersCollectionId) {
  return { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: usersCollectionId, cascadeDelete: true };
}

function collectionSpec({ name, usersCollectionId, fields, indexes }) {
  return {
    type: "base",
    name,
    listRule: ownerRule,
    viewRule: ownerRule,
    createRule: ownerRule,
    updateRule: ownerRule,
    deleteRule: ownerRule,
    fields: [relationToUsers(usersCollectionId), ...fields],
    indexes,
  };
}

function buildCollectionSpecs(usersCollectionId) {
  return [
    collectionSpec({
      name: "articles",
      usersCollectionId,
      fields: [
        { name: "client_id", type: "text", required: true, max: 120 },
        { name: "title", type: "text", required: true, max: 300 },
        { name: "source", type: "text", max: 200 },
        { name: "topic", type: "text", max: 100 },
        { name: "url", type: "text", max: 1000 },
        { name: "image", type: "text", max: 300 },
        { name: "difficulty", type: "select", required: true, maxSelect: 1, values: ["初级", "中级", "中高级", "高级"] },
        { name: "saved", type: "bool" },
        { name: "progress", type: "number", min: 0, max: 100 },
        { name: "text", type: "editor", required: true },
        { name: "analysis_json", type: "json", maxSize: 1048576 },
        { name: "reader_json", type: "json", maxSize: 2097152 },
        { name: "deleted_at", type: "date" },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_articles_user_client ON articles (user, client_id)"],
    }),
    collectionSpec({
      name: "vocabulary_items",
      usersCollectionId,
      fields: [
        { name: "client_id", type: "text", required: true, max: 120 },
        { name: "word", type: "text", required: true, max: 120 },
        { name: "phonetic", type: "text", max: 120 },
        { name: "part", type: "text", max: 40 },
        { name: "definition_zh", type: "text", required: true, max: 500 },
        { name: "context", type: "text", max: 1000 },
        { name: "article_id", type: "text", max: 120 },
        { name: "status", type: "select", required: true, maxSelect: 1, values: ["new", "learning", "review", "mastered"] },
        { name: "next_review_at", type: "date", required: true },
        { name: "repetition", type: "number", min: 0 },
        { name: "interval_days", type: "number", min: 0 },
        { name: "ease_factor", type: "number", min: 1 },
        { name: "deleted_at", type: "date" },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_vocab_user_client ON vocabulary_items (user, client_id)",
        "CREATE INDEX idx_vocab_user_due ON vocabulary_items (user, next_review_at)",
      ],
    }),
    collectionSpec({
      name: "daily_plans",
      usersCollectionId,
      fields: [
        { name: "date", type: "text", required: true, min: 10, max: 10, pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
        { name: "reading_target", type: "number", min: 0 },
        { name: "word_target", type: "number", min: 0 },
        { name: "review_target", type: "number", min: 0 },
        { name: "reading_done", type: "number", min: 0 },
        { name: "word_done", type: "number", min: 0 },
        { name: "review_done", type: "number", min: 0 },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_plans_user_date ON daily_plans (user, date)"],
    }),
    collectionSpec({
      name: "review_events",
      usersCollectionId,
      fields: [
        { name: "client_id", type: "text", required: true, max: 120 },
        { name: "vocabulary_client_id", type: "text", required: true, max: 120 },
        { name: "result", type: "select", required: true, maxSelect: 1, values: ["again", "hard", "good", "easy"] },
        { name: "reviewed_at", type: "date", required: true },
        { name: "response_ms", type: "number", min: 0 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_review_user_client ON review_events (user, client_id)",
        "CREATE INDEX idx_review_user_time ON review_events (user, reviewed_at)",
      ],
    }),
    collectionSpec({
      name: "notes",
      usersCollectionId,
      fields: [
        { name: "client_id", type: "text", required: true, max: 120 },
        { name: "article_id", type: "text", max: 120 },
        { name: "title", type: "text", required: true, max: 300 },
        { name: "body", type: "editor" },
        { name: "tags", type: "json", maxSize: 65536 },
        { name: "deleted_at", type: "date" },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_notes_user_client ON notes (user, client_id)"],
    }),
    collectionSpec({
      name: "user_settings",
      usersCollectionId,
      fields: [
        { name: "daily_goal", type: "number", min: 1, max: 50 },
        { name: "reminder_time", type: "text", max: 5 },
        { name: "notifications", type: "bool" },
        { name: "auto_save_words", type: "bool" },
        { name: "difficulty", type: "select", maxSelect: 1, values: ["初级", "中级", "中高级", "高级"] },
        { name: "ai_enabled", type: "bool" },
        { name: "ai_endpoint", type: "url" },
        { name: "ai_model", type: "text", max: 200 },
        { name: "ai_max_words", type: "number", min: 3, max: 30 },
        { name: "ai_prompt", type: "editor" },
        { name: "ai_api_key_encrypted", type: "text", max: 12000, hidden: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_settings_user ON user_settings (user)"],
    }),
  ];
}

function indexName(indexStatement) {
  return indexStatement.match(/INDEX\s+(\S+)/i)?.[1] || indexStatement;
}

function buildCollectionUpdate(existingCollection, spec) {
  const existingFields = new Map(existingCollection.fields.map((field) => [field.name, field]));
  const missingFields = [];
  const fieldOverrides = new Map();
  for (const expectedField of spec.fields) {
    const existingField = existingFields.get(expectedField.name);
    if (!existingField) {
      missingFields.push(expectedField);
      continue;
    }
    if (existingField.type !== expectedField.type) {
      throw new Error(`${spec.name}.${expectedField.name} 类型不兼容：线上为 ${existingField.type}，期望 ${expectedField.type}。`);
    }
    if (expectedField.hidden === true && existingField.hidden !== true) {
      fieldOverrides.set(expectedField.name, { ...existingField, hidden: true });
    }
  }

  const existingIndexNames = new Set((existingCollection.indexes || []).map(indexName));
  const missingIndexes = spec.indexes.filter((index) => !existingIndexNames.has(indexName(index)));
  const rulesChanged = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"].some((key) => existingCollection[key] !== spec[key]);
  if (!missingFields.length && !fieldOverrides.size && !missingIndexes.length && !rulesChanged) return null;

  return {
    fields: [...existingCollection.fields.map((field) => fieldOverrides.get(field.name) || field), ...missingFields],
    indexes: [...(existingCollection.indexes || []), ...missingIndexes],
    listRule: spec.listRule,
    viewRule: spec.viewRule,
    createRule: spec.createRule,
    updateRule: spec.updateRule,
    deleteRule: spec.deleteRule,
  };
}

const existingCollections = await pocketBase.collections.getFullList();
const usersCollection = existingCollections.find((collection) => collection.name === "users" && collection.type === "auth");
if (!usersCollection) throw new Error("在线 PocketBase 缺少 users 认证集合。");

const results = [];
for (const spec of buildCollectionSpecs(usersCollection.id)) {
  const existingCollection = existingCollections.find((collection) => collection.name === spec.name);
  if (!existingCollection) {
    const created = await pocketBase.collections.create(spec);
    results.push({ name: created.name, action: "created", fieldCount: created.fields.length });
    continue;
  }

  if (existingCollection.type !== "base") throw new Error(`${spec.name} 已存在，但不是 base collection。`);
  const update = buildCollectionUpdate(existingCollection, spec);
  if (!update) {
    results.push({ name: spec.name, action: "unchanged", fieldCount: existingCollection.fields.length });
    continue;
  }
  const updated = await pocketBase.collections.update(existingCollection.id, update);
  results.push({ name: updated.name, action: "updated", fieldCount: updated.fields.length });
}

const verifiedCollections = await pocketBase.collections.getFullList();
const verification = buildCollectionSpecs(usersCollection.id).map((spec) => {
  const collection = verifiedCollections.find((candidate) => candidate.name === spec.name);
  const fieldNames = new Set(collection?.fields.map((field) => field.name) || []);
  return {
    name: spec.name,
    exists: Boolean(collection),
    missingFields: spec.fields.map((field) => field.name).filter((name) => !fieldNames.has(name)),
  };
});

if (verification.some((collection) => !collection.exists || collection.missingFields.length)) {
  throw new Error(`迁移后结构校验失败：${JSON.stringify(verification)}`);
}

console.log(JSON.stringify({ url: POCKETBASE_URL, results, verification }, null, 2));
