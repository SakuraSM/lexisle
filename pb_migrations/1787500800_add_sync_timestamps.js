migrate((app) => {
  ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"].forEach((collectionName) => {
    const collection = app.findCollectionByNameOrId(collectionName);
    if (!collection.fields.getByName("created")) {
      collection.fields.add(new AutodateField({
        name: "created",
        onCreate: true,
      }));
    }
    if (!collection.fields.getByName("updated")) {
      collection.fields.add(new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }));
    }
    app.save(collection);
  });
}, () => {
  // Sync cursors depend on these timestamps. Rolling back keeps the fields and data intact.
});
