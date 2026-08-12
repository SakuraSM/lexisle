import { useState } from "react";
import { BellIcon, CheckCircledIcon, GearIcon, GlobeIcon, LightningBoltIcon, LockClosedIcon, PersonIcon } from "@radix-ui/react-icons";
import { PageHeader } from "./PagePrimitives.jsx";
import { DEFAULT_AI_PROMPT, readAiApiKey, saveAiApiKey, testAiConnection } from "../lib/aiVocabulary.js";

export function SettingsPage({ state, actions, user, openAccount, syncStatus, syncNow, notify }) {
  const [draft, setDraft] = useState(state.settings);
  const [aiKey, setAiKey] = useState(readAiApiKey);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState("");
  const update = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const updateAi = (patch) => setDraft((value) => ({ ...value, ai: { ...value.ai, ...patch } }));
  const save = () => {
    actions.updateSettings(draft);
    saveAiApiKey(aiKey, draft.ai.rememberKey);
    notify("设置已保存，API Key 仅保留在当前浏览器");
  };
  const testAi = async () => {
    setTestingAi(true);
    setAiTestResult("");
    try {
      await testAiConnection(draft.ai, aiKey);
      setAiTestResult("连接成功，可以使用此模型分析词汇。");
    } catch (error) {
      setAiTestResult(error.message || "连接失败，请检查配置。");
    } finally {
      setTestingAi(false);
    }
  };
  const requestNotifications = async (enabled) => {
    if (!enabled) { update({ notifications: false }); return; }
    if (!("Notification" in window)) { notify("当前浏览器不支持系统通知"); return; }
    const permission = await Notification.requestPermission();
    update({ notifications: permission === "granted" });
    notify(permission === "granted" ? "复习提醒已开启" : "未获得通知权限");
  };
  return (
    <div className="page settings-page">
      <PageHeader title="设置" description="管理学习目标、提醒、同步和账户。" />
      <div className="settings-layout">
        <section className="settings-section open-panel"><div className="settings-heading"><GearIcon /><div><h2>学习偏好</h2><p>调整每日目标与默认阅读难度</p></div></div><label><span>每日生词目标</span><input type="number" min="1" max="50" value={draft.dailyGoal} onChange={(event) => update({ dailyGoal: Number(event.target.value) })} /></label><label><span>默认文章难度</span><select value={draft.difficulty} onChange={(event) => update({ difficulty: event.target.value })}><option>初级</option><option>中级</option><option>中高级</option><option>高级</option></select></label><label className="toggle-row"><div><span>阅读时自动收藏生词</span><small>点击高亮词汇后自动加入词汇本</small></div><input type="checkbox" checked={draft.autoSaveWords} onChange={(event) => update({ autoSaveWords: event.target.checked })} /></label></section>
        <section className="settings-section open-panel"><div className="settings-heading"><BellIcon /><div><h2>复习提醒</h2><p>每天在固定时间提醒到期词汇</p></div></div><label className="toggle-row"><div><span>浏览器通知</span><small>仅在获得系统权限后发送</small></div><input type="checkbox" checked={draft.notifications} onChange={(event) => requestNotifications(event.target.checked)} /></label><label><span>每日提醒时间</span><input type="time" value={draft.reminderTime} onChange={(event) => update({ reminderTime: event.target.value })} /></label></section>
        <section className="settings-section open-panel"><div className="settings-heading"><GlobeIcon /><div><h2>数据同步</h2><p>PocketBase · pocket.nings.top</p></div></div>{user ? <div className="sync-account"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><i><CheckCircledIcon />{syncStatus}</i></div> : <div className="anonymous-state"><PersonIcon /><div><strong>当前使用本地模式</strong><span>登录后可跨设备同步学习记录。</span></div></div>}<button className="secondary-button full" type="button" onClick={user ? syncNow : openAccount}>{user ? "立即同步" : "登录或注册"}</button></section>
        <section className="settings-section ai-settings open-panel">
          <div className="settings-heading"><LightningBoltIcon /><div><h2>AI 单词识别</h2><p>连接任意 OpenAI 兼容模型；失败时自动回退本地识别</p></div></div>
          <label className="toggle-row ai-enable-row"><div><span>启用 AI 分析</span><small>文章仅在导入分析时发送到你配置的模型服务</small></div><input type="checkbox" checked={draft.ai.enabled} onChange={(event) => updateAi({ enabled: event.target.checked })} /></label>
          <div className="ai-config-grid">
            <label><span>接口地址</span><input type="url" value={draft.ai.endpoint} onChange={(event) => updateAi({ endpoint: event.target.value })} placeholder="https://api.example.com/v1" /><small>可填写 API Base URL 或完整的 /chat/completions 地址</small></label>
            <label><span>模型名称</span><input value={draft.ai.model} onChange={(event) => updateAi({ model: event.target.value })} placeholder="provider-model-name" /><small>使用供应商文档给出的精确模型 ID</small></label>
            <label><span>API Key</span><input type="password" value={aiKey} onChange={(event) => setAiKey(event.target.value)} placeholder="sk-••••••••" autoComplete="off" /><small><LockClosedIcon /> 不同步到 PocketBase，不写入代码或构建产物</small></label>
            <label><span>最多识别</span><div className="number-with-unit"><input type="number" min="3" max="30" value={draft.ai.maxWords} onChange={(event) => updateAi({ maxWords: Number(event.target.value) })} /><em>个词</em></div><small>模型输出仍会经过原文和结构校验</small></label>
          </div>
          <label className="ai-prompt-field"><span>自定义分析指令</span><textarea rows="3" value={draft.ai.prompt} onChange={(event) => updateAi({ prompt: event.target.value })} placeholder={DEFAULT_AI_PROMPT} /></label>
          <label className="remember-key"><input type="checkbox" checked={draft.ai.rememberKey} onChange={(event) => updateAi({ rememberKey: event.target.checked })} /><span>关闭浏览器后仍保留 API Key</span></label>
          <div className="ai-actions"><button className="secondary-button" type="button" disabled={testingAi} onClick={testAi}>{testingAi ? "正在测试…" : "测试连接"}</button>{aiTestResult ? <span className={aiTestResult.startsWith("连接成功") ? "is-success" : "is-error"}>{aiTestResult}</span> : <span>直接从浏览器请求模型，供应商需允许跨域访问。</span>}</div>
        </section>
      </div><div className="settings-actions"><button className="primary-button" type="button" onClick={save}>保存设置</button></div>
    </div>
  );
}
