import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seedState } from "../src/data/seed.js";
import { ProgressMeter } from "../src/pages/PagePrimitives.jsx";
import { ReviewPage } from "../src/pages/ReviewPage.jsx";
import { ReaderPage } from "../src/pages/ReaderPage.jsx";
import { SettingsPage } from "../src/pages/SettingsPage.jsx";
import { VocabularyPage } from "../src/pages/VocabularyPage.jsx";
import { createReaderData } from "../src/lib/reader.js";

describe("accessible product pages", () => {
  it("exposes the custom meter as a progressbar", () => {
    render(<ProgressMeter value={3} max={5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("lets keyboard users select vocabulary through a button", () => {
    render(<VocabularyPage state={seedState} actions={{ removeVocabulary: vi.fn() }} />);
    expect(screen.getByRole("button", { name: /^cortex/ })).toBeVisible();
  });

  it("shows review intervals calculated by the scheduling algorithm", () => {
    const state = structuredClone(seedState);
    state.vocabulary[0].nextReviewAt = "2020-01-01T00:00:00.000Z";
    render(<ReviewPage state={state} actions={{ recordReview: vi.fn() }} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "显示答案" }));
    expect(screen.getByRole("button", { name: /记得5 天/ })).toBeVisible();
  });

  it("switches to reading-to-learn mode with complete tab semantics", () => {
    const updateReaderProgress = vi.fn();
    render(<ReaderPage article={seedState.articles[0]} state={seedState} actions={{ updateReaderProgress, toggleArticleSaved: vi.fn(), addVocabulary: vi.fn(), updateProgress: vi.fn() }} close={vi.fn()} navigate={vi.fn()} notify={vi.fn()} />);
    const focusTab = screen.getByRole("tab", { name: "阅读记词" });
    expect(focusTab).toHaveAttribute("aria-selected", "false");
    fireEvent.click(focusTab);
    expect(updateReaderProgress).toHaveBeenCalledWith(seedState.articles[0].id, { mode: "focus" });
  });

  it("lets users inspect and explicitly save any word in focus mode", () => {
    const article = structuredClone(seedState.articles[0]);
    article.readerData = { ...createReaderData(article), mode: "focus" };
    const addVocabulary = vi.fn();
    render(<ReaderPage article={article} state={{ ...seedState, settings: { ...seedState.settings, autoSaveWords: true } }} actions={{ updateReaderProgress: vi.fn(), toggleArticleSaved: vi.fn(), addVocabulary, updateProgress: vi.fn() }} close={vi.fn()} navigate={vi.fn()} notify={vi.fn()} />);
    const ordinary = screen.getAllByRole("button", { name: "the" })[0];
    fireEvent.click(ordinary);
    expect(screen.getByText("本地词典暂无释义")).toBeVisible();
    expect(addVocabulary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /加入生词本/ }));
    expect(addVocabulary).toHaveBeenCalledTimes(1);
  });

  it("closes the focus word inspector with Escape", () => {
    const article = structuredClone(seedState.articles[0]);
    article.readerData = { ...createReaderData(article), mode: "focus" };
    render(<ReaderPage article={article} state={seedState} actions={{ updateReaderProgress: vi.fn(), toggleArticleSaved: vi.fn(), addVocabulary: vi.fn(), updateProgress: vi.fn() }} close={vi.fn()} navigate={vi.fn()} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "cortex" }));
    expect(screen.getByRole("button", { name: "关闭单词详情" })).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "关闭单词详情" })).not.toBeInTheDocument();
  });

  it("keeps server AI settings behind authentication", () => {
    const openAccount = vi.fn();
    render(<SettingsPage state={seedState} actions={{ updateSettings: vi.fn() }} user={null} openAccount={openAccount} syncStatus={{ kind: "local", label: "本地模式" }} syncNow={vi.fn()} notify={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /接口地址/ })).toBeDisabled();
    expect(screen.getByText("浏览器只请求 PocketBase，不直接连接模型供应商。")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "登录或注册" }).at(-1));
    expect(openAccount).toHaveBeenCalledTimes(1);
  });
});
