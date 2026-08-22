routerAdd("POST", "/api/lexisle/import/article", (e) => {
  const articleImport = require(`${__hooks}/lexisle_import.js`);
  return articleImport.importArticle(e);
}, $apis.bodyLimit(4096));
