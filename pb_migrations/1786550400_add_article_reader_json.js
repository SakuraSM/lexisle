migrate((app) => {
  const articles = app.findCollectionByNameOrId("articles");
  if (!articles.fields.getByName("reader_json")) {
    articles.fields.add(new JSONField({
      name: "reader_json",
      maxSize: 2097152,
    }));
    app.save(articles);
  }
}, (app) => {
  const articles = app.findCollectionByNameOrId("articles");
  const field = articles.fields.getByName("reader_json");
  if (field) {
    articles.fields.removeById(field.id);
    app.save(articles);
  }
});
