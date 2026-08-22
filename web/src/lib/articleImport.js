import { pb } from "./pocketbaseClient.js";

const MIN_ARTICLE_WORDS = 40;

function validateArticleText(text) {
  const normalizedText = String(text || "").trim();
  if (normalizedText.split(/\s+/).length < MIN_ARTICLE_WORDS) throw new Error("文章内容太短，请至少提供 40 个英文单词。");
  return normalizedText;
}

export function preparePastedArticle({ text, title }) {
  return {
    title: String(title || "").trim() || "未命名英文文章",
    text: validateArticleText(text),
    source: "手动粘贴",
  };
}

export async function importArticleFromUrl(url, sendImpl = (path, options) => pb.send(path, options)) {
  const targetUrl = String(url || "").trim();
  if (!/^https?:\/\//i.test(targetUrl)) throw new Error("请输入完整的 http(s) 文章链接。");
  try {
    const article = await sendImpl("/api/lexisle/import/article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl }),
    });
    return {
      title: String(article?.title || "").trim() || new URL(targetUrl).hostname,
      text: validateArticleText(article?.text),
      source: String(article?.source || new URL(targetUrl).hostname).trim(),
    };
  } catch (error) {
    if (error instanceof TypeError || error?.status === 404) throw new Error("文章读取服务尚未部署，请改为粘贴英文原文。");
    throw new Error(error?.response?.message || error?.message || "无法读取此链接，请改为粘贴英文原文。");
  }
}
