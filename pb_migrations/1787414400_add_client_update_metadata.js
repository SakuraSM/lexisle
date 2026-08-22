migrate((app) => {
  ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"].forEach((collectionName) => {
    const collection = app.findCollectionByNameOrId(collectionName);
    if (collection.fields.getByName("client_updated_at")) return;
    collection.fields.add(new DateField({ name: "client_updated_at" }));
    app.save(collection);
  });
}, (app) => {
  ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"].forEach((collectionName) => {
    const collection = app.findCollectionByNameOrId(collectionName);
    const field = collection.fields.getByName("client_updated_at");
    if (!field) return;
    collection.fields.removeById(field.id);
    app.save(collection);
  });
});
