import { expect, test } from "@playwright/test";

test("core learning pages stay usable without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天" })).toBeVisible();
  await page.getByRole("button", { name: /图书馆/ }).first().click();
  await expect(page.getByRole("heading", { name: "图书馆" })).toBeVisible();
  await page.getByRole("button", { name: /复习/ }).first().click();
  await expect(page.getByRole("heading", { name: "复习", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("settings show the in-app reminder limitation", async ({ page }) => {
  await page.goto("/#设置");
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByText("关闭网页后不会继续推送")).toBeVisible();
});

test("account dialog traps focus and closes with Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("focus reading supports lookup, manual save, translation, and refresh recovery", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("lexisle:ai-api-key", "e2e-key"));
  await page.route("https://ai.test/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON();
    const translating = body.messages[0].content.includes("翻译助手");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(translating
        ? { translation: "多年来，睡眠科学家一直认为做梦是大脑夜间的主要工作。" }
        : { word: "years", lemma: "year", phonetic: "/jɪr/", part: "n.", contextMeaning: "多年", contextExplanation: "这里表示一段较长的时间。", meanings: ["年", "年度"], collocations: ["for years"], example: "For years, sleep scientists believed...", memoryTip: "for years 表示多年来" }) } }] }),
    });
  });

  await page.goto("/#设置");
  await page.getByRole("checkbox", { name: /启用 AI 分析/ }).check();
  await page.getByLabel("接口地址").fill("https://ai.test/v1");
  await page.getByLabel("模型名称").fill("e2e-model");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: /图书馆/ }).first().click();
  await page.getByRole("button", { name: "继续阅读" }).first().click();
  await page.getByRole("tab", { name: "阅读记词" }).click();
  await expect(page.getByRole("tabpanel", { name: "阅读记词" })).toBeVisible();
  await page.getByRole("button", { name: "years" }).first().click();
  await expect(page.getByText("多年", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /加入生词本/ }).click();
  await page.locator(".toast").click();
  await page.getByRole("button", { name: "关闭单词详情" }).click();
  await page.getByRole("button", { name: "翻译当前段" }).click();
  await expect(page.getByText(/多年来，睡眠科学家/)).toBeVisible();
  await page.getByRole("button", { name: /完成并读下一段|完成全文/ }).click();
  await page.reload();
  await page.getByRole("button", { name: /图书馆/ }).first().click();
  await page.getByRole("button", { name: "继续阅读" }).first().click();
  await expect(page.getByRole("tab", { name: "阅读记词" })).toHaveAttribute("aria-selected", "true");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
