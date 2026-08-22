routerAdd("GET", "/api/lexisle/meta", (e) => e.json(200, {
  hookVersion: "2.0.0",
  localSchemaVersion: 4,
  features: {
    serverAi: true,
    aiProxy: true,
    articleImport: true,
    structuredAiResponses: true,
  },
}));
