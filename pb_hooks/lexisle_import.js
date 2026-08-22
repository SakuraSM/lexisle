const MAX_ARTICLE_RESPONSE_LENGTH = 1048576;
const MIN_ARTICLE_WORDS = 40;

function isPrivateIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const values = parts.map(Number);
  const a = values[0];
  const b = values[1];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function cleanReaderText(raw) {
  return String(raw || "")
    .replace(/^Title:.*$/gm, "")
    .replace(/^URL Source:.*$/gm, "")
    .replace(/^Markdown Content:.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTargetUrl(value) {
  const targetUrl = String(value || "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(targetUrl)) throw new BadRequestError("请输入完整的 http(s) 文章链接。");
  const authority = targetUrl.match(/^https?:\/\/([^/?#]+)/i)?.[1] || "";
  if (!authority || authority.includes("@")) throw new BadRequestError("文章链接格式不正确。");
  let host = authority.toLowerCase();
  if (host.startsWith("[")) {
    const closing = host.indexOf("]");
    if (closing < 0) throw new BadRequestError("文章链接格式不正确。");
    host = host.slice(1, closing);
  } else {
    const parts = host.split(":");
    if (parts.length > 2 || (parts.length === 2 && !/^\d{1,5}$/.test(parts[1]))) throw new BadRequestError("文章链接端口格式不正确。");
    host = parts[0];
  }
  const blockedName = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan");
  const blockedIpv6 = host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  if (blockedName || blockedIpv6 || /^\d+$/.test(host) || /^0x/i.test(host) || isPrivateIpv4(host)) throw new BadRequestError("文章链接不能指向本机或内网地址。");
  return targetUrl;
}

function importArticle(e) {
  const request = new DynamicModel({ url: "" });
  e.bindBody(request);
  const targetUrl = normalizeTargetUrl(request.url);
  let response;
  try {
    response = $http.send({
      url: `https://r.jina.ai/${targetUrl}`,
      method: "GET",
      headers: { Accept: "text/plain" },
      timeout: 15,
    });
  } catch (_) {
    return e.json(502, { message: "文章读取服务连接失败，请改为粘贴英文原文。", status: 502 });
  }
  if (response.statusCode < 200 || response.statusCode >= 300) return e.json(502, { message: "无法读取此链接，请改为粘贴英文原文。", status: 502 });
  const raw = String(response.raw || "");
  if (!raw || raw.length > MAX_ARTICLE_RESPONSE_LENGTH) return e.json(422, { message: "文章内容为空或超过 1 MB。", status: 422 });
  const text = cleanReaderText(raw);
  if (text.split(/\s+/).length < MIN_ARTICLE_WORDS) return e.json(422, { message: "文章内容太短，请至少提供 40 个英文单词。", status: 422 });
  const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || authorityFromUrl(targetUrl);
  return e.json(200, { title: title.slice(0, 300), text, source: authorityFromUrl(targetUrl) });
}

function authorityFromUrl(targetUrl) {
  return String(targetUrl.match(/^https?:\/\/([^/?#]+)/i)?.[1] || "在线文章").replace(/^www\./i, "");
}

module.exports = { cleanReaderText, importArticle, isPrivateIpv4, normalizeTargetUrl };
