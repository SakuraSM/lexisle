migrate((app) => {
  let users;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch {
    users = new Collection({
      type: "auth",
      name: "users",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: "",
      updateRule: "id = @request.auth.id",
      deleteRule: "id = @request.auth.id",
      fields: [
        { name: "name", type: "text", max: 120 },
        { name: "timezone", type: "text", max: 80 },
        { name: "daily_goal", type: "number", min: 1, max: 50 },
      ],
      passwordAuth: { enabled: true, identityFields: ["email"] },
    });
    app.save(users);
  }
  const ownerRule = "user = @request.auth.id";
  const createRule = "@request.auth.id != '' && user = @request.auth.id";

  const collection = (name, fields, indexes) => new Collection({
    type: "base",
    name,
    listRule: ownerRule,
    viewRule: ownerRule,
    createRule,
    updateRule: ownerRule,
    deleteRule: ownerRule,
    fields: [
      { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      ...fields,
    ],
    indexes,
  });

  app.save(collection("articles", [
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
    { name: "deleted_at", type: "date" },
  ], [
    "CREATE UNIQUE INDEX idx_articles_user_client ON articles (user, client_id)",
  ]));

  app.save(collection("vocabulary_items", [
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
  ], [
    "CREATE UNIQUE INDEX idx_vocab_user_client ON vocabulary_items (user, client_id)",
    "CREATE INDEX idx_vocab_user_due ON vocabulary_items (user, next_review_at)",
  ]));

  app.save(collection("daily_plans", [
    { name: "date", type: "text", required: true, min: 10, max: 10, pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    { name: "reading_target", type: "number", min: 0 },
    { name: "word_target", type: "number", min: 0 },
    { name: "review_target", type: "number", min: 0 },
    { name: "reading_done", type: "number", min: 0 },
    { name: "word_done", type: "number", min: 0 },
    { name: "review_done", type: "number", min: 0 },
  ], ["CREATE UNIQUE INDEX idx_plans_user_date ON daily_plans (user, date)"]));

  app.save(collection("review_events", [
    { name: "client_id", type: "text", required: true, max: 120 },
    { name: "vocabulary_client_id", type: "text", required: true, max: 120 },
    { name: "result", type: "select", required: true, maxSelect: 1, values: ["again", "hard", "good", "easy"] },
    { name: "reviewed_at", type: "date", required: true },
    { name: "response_ms", type: "number", min: 0 },
  ], [
    "CREATE UNIQUE INDEX idx_review_user_client ON review_events (user, client_id)",
    "CREATE INDEX idx_review_user_time ON review_events (user, reviewed_at)",
  ]));

  app.save(collection("notes", [
    { name: "client_id", type: "text", required: true, max: 120 },
    { name: "article_id", type: "text", max: 120 },
    { name: "title", type: "text", required: true, max: 300 },
    { name: "body", type: "editor" },
    { name: "tags", type: "json", maxSize: 65536 },
    { name: "deleted_at", type: "date" },
  ], ["CREATE UNIQUE INDEX idx_notes_user_client ON notes (user, client_id)"]));

  app.save(collection("user_settings", [
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
  ], ["CREATE UNIQUE INDEX idx_settings_user ON user_settings (user)"]));
}, (app) => {
  ["user_settings", "notes", "review_events", "daily_plans", "vocabulary_items", "articles"].forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch {
      // The down migration is intentionally idempotent.
    }
  });
});
