migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_settings");
  if (!collection.fields.getByName("ai_api_key_encrypted")) {
    collection.fields.add(new TextField({
      name: "ai_api_key_encrypted",
      max: 12000,
      hidden: true,
    }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_settings");
  const field = collection.fields.getByName("ai_api_key_encrypted");
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
  }
});
