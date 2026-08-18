const DEFAULT_PROMPT = "识别对中级英语学习者较生僻、且对理解文章重要的词汇。优先选择能通过上下文学习的实词，避免人名、地名、数字和过于基础的词。";

function findSettings(app, userId) {
  app.findCollectionByNameOrId("user_settings");
  try {
    return app.findFirstRecordByFilter("user_settings", "user = {:user}", { user: userId });
  } catch (_) {
    return null;
  }
}

function publicSettings(record) {
  if (!record) return { enabled: false, endpoint: "", model: "", maxWords: 12, prompt: "", keyConfigured: false };
  return {
    enabled: record.getBool("ai_enabled"),
    endpoint: record.getString("ai_endpoint"),
    model: record.getString("ai_model"),
    maxWords: Math.min(30, Math.max(3, record.getInt("ai_max_words") || 12)),
    prompt: record.getString("ai_prompt"),
    keyConfigured: Boolean(record.getString("ai_api_key_encrypted")),
  };
}

function encryptionKey() {
  const key = $os.getenv("LEXISLE_AI_ENCRYPTION_KEY");
  if (key.length !== 32) throw new InternalServerError("AI 服务端加密密钥未正确配置。");
  return key;
}

function isPrivateIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const values = parts.map(Number);
  const a = values[0];
  const b = values[1];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function normalizeEndpoint(value) {
  let endpoint = String(value || "").trim().replace(/\/+$/, "");
  if (!endpoint) return "";
  if (!/\/chat\/completions$/i.test(endpoint)) endpoint += "/chat/completions";
  const parsed = endpoint.match(/^(https?):\/\/([^\/?#]+)(\/[^?#]*)$/i);
  if (!parsed) throw new BadRequestError("模型接口地址格式不正确。");
  const allowHttp = $os.getenv("LEXISLE_AI_ALLOW_HTTP") === "true";
  const protocol = parsed[1].toLowerCase();
  const authority = parsed[2];
  if (protocol !== "https" && !(allowHttp && protocol === "http")) throw new BadRequestError("模型接口必须使用 HTTPS。");
  if (authority.includes("@")) throw new BadRequestError("模型接口地址不能包含账号信息。");
  let host = authority.toLowerCase();
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");
    if (closing < 0) throw new BadRequestError("模型接口地址格式不正确。");
    const port = host.slice(closing + 1);
    if (port && !/^:\d{1,5}$/.test(port)) throw new BadRequestError("模型接口端口格式不正确。");
    host = host.slice(1, closing);
  } else {
    const parts = host.split(":");
    if (parts.length > 2 || (parts.length === 2 && !/^\d{1,5}$/.test(parts[1]))) throw new BadRequestError("模型接口端口格式不正确。");
    host = parts[0];
  }
  const blockedName = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan");
  const blockedIpv6 = host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  const unusualNumericHost = /^\d+$/.test(host) || /^0x/i.test(host);
  if (blockedName || blockedIpv6 || unusualNumericHost || isPrivateIpv4(host)) {
    if (!(allowHttp && (host === "127.0.0.1" || host === "localhost"))) throw new BadRequestError("模型接口不能指向本机或内网地址。");
  }
  return endpoint;
}

function saveSettings(e) {
  const data = new DynamicModel({ enabled: false, endpoint: "", model: "", maxWords: 12, prompt: "", apiKey: "", clearApiKey: false });
  e.bindBody(data);

  const endpoint = normalizeEndpoint(data.endpoint);
  const model = String(data.model || "").trim();
  const prompt = String(data.prompt || "").trim();
  const apiKey = String(data.apiKey || "").trim();
  const maxWords = Math.min(30, Math.max(3, Number(data.maxWords) || 12));
  if (model.length > 200) throw new BadRequestError("模型名称不能超过 200 个字符。");
  if (prompt.length > 8000) throw new BadRequestError("分析指令不能超过 8000 个字符。");
  if (apiKey.length > 8192) throw new BadRequestError("API Key 长度异常。");

  let record = findSettings(e.app, e.auth.id);
  if (!record) {
    record = new Record(e.app.findCollectionByNameOrId("user_settings"));
    record.set("user", e.auth.id);
  }

  let encryptedKey = record.getString("ai_api_key_encrypted");
  if (data.clearApiKey) encryptedKey = "";
  if (apiKey) encryptedKey = $security.encrypt(apiKey, encryptionKey());
  if (data.enabled && (!endpoint || !model || !encryptedKey)) throw new BadRequestError("启用 AI 前请填写模型接口、模型名称和 API Key。");

  record.set("ai_enabled", Boolean(data.enabled));
  record.set("ai_endpoint", endpoint);
  record.set("ai_model", model);
  record.set("ai_max_words", maxWords);
  record.set("ai_prompt", prompt);
  record.set("ai_api_key_encrypted", encryptedKey);
  e.app.save(record);
  return publicSettings(record);
}

function buildMessages(operation, data, settings) {
  if (operation === "test") {
    return [
      { role: "system", content: "你是接口连通性测试助手。只输出 JSON 数组。" },
      { role: "user", content: "返回一个空 JSON 数组 []。" },
    ];
  }
  if (operation === "analyze-vocabulary") {
    const articleText = String(data.articleText || "").slice(0, 24000);
    if (!articleText.trim()) throw new BadRequestError("缺少英文文章内容。");
    return [
      { role: "system", content: "你是英语词汇学习专家。只输出 JSON 数组，不要 Markdown。数组项格式：{word, phonetic, part, definition, example, reason}。definition 使用简体中文；example 必须摘自原文；word 必须是原文中出现的单个英文单词。" },
      { role: "user", content: `${settings.prompt || DEFAULT_PROMPT}\n\n最多返回 ${settings.maxWords} 个词。\n\n英文原文：\n${articleText}` },
    ];
  }
  if (operation === "translate-segment") {
    const segmentText = String(data.segmentText || "").slice(0, 5000);
    if (!segmentText.trim()) throw new BadRequestError("缺少待翻译段落。");
    return [
      { role: "system", content: "你是英语阅读翻译助手。只输出 JSON 对象 {translation}。translation 使用简体中文，忠实、自然，不增加原文没有的信息。" },
      { role: "user", content: `相邻语境（仅用于消歧）：\n前文：${String(data.previous || "").slice(0, 320)}\n后文：${String(data.next || "").slice(0, 320)}\n\n请翻译当前段落：\n${segmentText}` },
    ];
  }
  if (operation === "lookup-word") {
    const word = String(data.word || "").trim().toLowerCase().slice(0, 120);
    const sentence = String(data.sentence || "").slice(0, 1200);
    const segmentText = String(data.segmentText || "").slice(0, 5000);
    if (!/^[a-z]+(?:'[a-z]+)?$/.test(word) || !segmentText.trim()) throw new BadRequestError("查词请求内容不完整。");
    return [
      { role: "system", content: "你是英语词汇学习专家。只输出 JSON 对象，字段为 word, lemma, phonetic, part, contextMeaning, contextExplanation, meanings, collocations, example, memoryTip。中文解释使用简体中文；meanings 和 collocations 最多各 3 项；example 必须基于当前语境。" },
      { role: "user", content: `目标词：${word}\n所在句：${sentence}\n当前段落：${segmentText}` },
    ];
  }
  throw new NotFoundError("不支持的 AI 操作。");
}

function callProvider(e, operation) {
  const record = findSettings(e.app, e.auth.id);
  const settings = publicSettings(record);
  if (!record || !settings.enabled) throw new BadRequestError("请先在设置中启用服务端 AI。");
  if (!settings.endpoint || !settings.model || !settings.keyConfigured) throw new BadRequestError("服务端 AI 配置不完整。");

  const data = new DynamicModel({ articleText: "", segmentText: "", previous: "", next: "", word: "", sentence: "" });
  e.bindBody(data);
  const messages = buildMessages(operation, data, settings);

  let apiKey;
  try {
    apiKey = $security.decrypt(record.getString("ai_api_key_encrypted"), encryptionKey());
  } catch (_) {
    throw new InternalServerError("服务端无法读取模型密钥，请重新保存 AI 设置。");
  }

  let response;
  try {
    response = $http.send({
      url: normalizeEndpoint(settings.endpoint),
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: settings.model, temperature: 0.2, messages }),
      timeout: 45,
    });
  } catch (_) {
    return e.json(502, { message: "模型服务连接失败或请求超时。", status: 502 });
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const providerMessage = String(response.json?.error?.message || `模型接口返回 ${response.statusCode}`).slice(0, 500);
    return e.json(502, { message: providerMessage, status: 502 });
  }
  const content = response.json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length > 100000) return e.json(502, { message: "模型响应格式不正确。", status: 502 });
  return e.json(200, { content, model: settings.model });
}

module.exports = { callProvider, findSettings, publicSettings, saveSettings };
