import test from "node:test";
import assert from "node:assert/strict";
import { importArticleFromUrl, preparePastedArticle } from "../src/lib/articleImport.js";

const LONG_ARTICLE = Array.from({ length: 45 }, (_, index) => `word${index}`).join(" ");

test("normalizes pasted articles through the shared import interface", () => {
  const article = preparePastedArticle({ title: "  Reading  ", text: `  ${LONG_ARTICLE}  ` });
  assert.equal(article.title, "Reading");
  assert.equal(article.source, "手动粘贴");
  assert.equal(article.text, LONG_ARTICLE);
});

test("imports URLs only through the PocketBase article route", async () => {
  const send = async (path, options) => {
    assert.equal(path, "/api/lexisle/import/article");
    assert.deepEqual(JSON.parse(options.body), { url: "https://example.com/article" });
    return { title: "Remote article", text: LONG_ARTICLE, source: "example.com" };
  };
  const article = await importArticleFromUrl("https://example.com/article", send);
  assert.equal(article.title, "Remote article");
  assert.equal(article.source, "example.com");
});

test("keeps pasted text as the recovery path when the import hook is missing", async () => {
  await assert.rejects(
    () => importArticleFromUrl("https://example.com/article", async () => { throw Object.assign(new Error("missing"), { status: 404 }); }),
    /尚未部署/,
  );
});
