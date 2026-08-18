routerAdd("GET", "/api/lexisle/ai/settings", (e) => {
  const ai = require(`${__hooks}/lexisle_ai.js`);
  return e.json(200, ai.publicSettings(ai.findSettings(e.app, e.auth.id)));
}, $apis.requireAuth("users"));

routerAdd("PUT", "/api/lexisle/ai/settings", (e) => {
  const ai = require(`${__hooks}/lexisle_ai.js`);
  return e.json(200, ai.saveSettings(e));
}, $apis.requireAuth("users"), $apis.bodyLimit(32768));

routerAdd("POST", "/api/lexisle/ai/{operation}", (e) => {
  const ai = require(`${__hooks}/lexisle_ai.js`);
  return ai.callProvider(e, e.request.pathValue("operation"));
}, $apis.requireAuth("users"), $apis.bodyLimit(32768));
