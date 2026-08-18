import { useEffect, useState } from "react";
import { BellIcon, CheckCircledIcon, GearIcon, GlobeIcon, LightningBoltIcon, LockClosedIcon, PersonIcon } from "@radix-ui/react-icons";
import { PageHeader } from "./PagePrimitives.jsx";
import { DEFAULT_AI_PROMPT, loadAiProviderSettings, saveAiProviderSettings, testAiConnection } from "../lib/aiVocabulary.js";

export function SettingsPage({ state, actions, user, openAccount, syncStatus, syncNow, notify }) {
  const userId = user?.id;
  const [draft, setDraft] = useState(state.settings);
  const [aiKey, setAiKey] = useState("");
  const [clearAiKey, setClearAiKey] = useState(false);
  const [aiKeyConfigured, setAiKeyConfigured] = useState(Boolean(state.settings.ai?.keyConfigured));
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const update = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const updateAi = (patch) => setDraft((value) => ({ ...value, ai: { ...value.ai, ...patch } }));

  useEffect(() => {
    if (!userId) {
      setAiKeyConfigured(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingAi(true);
    loadAiProviderSettings().then((settings) => {
      if (cancelled) return;
      setAiKeyConfigured(Boolean(settings.keyConfigured));
      setDraft((value) => ({ ...value, ai: { ...value.ai, ...settings } }));
    }).catch((error) => {
      if (!cancelled) setAiTestResult(error.message || "无法读取服务端 AI 设置。");
    }).finally(() => {
      if (!cancelled) setLoadingAi(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const persistAiSettings = async () => {
    if (!user) throw new Error("请先登录，再配置服务端 AI。");
    const saved = await saveAiProviderSettings(draft.ai, { apiKey: aiKey, clearApiKey: clearAiKey });
    setAiKey("");
    setClearAiKey(false);
    setAiKeyConfigured(Boolean(saved.keyConfigured));
    const nextSettings = { ...draft, ai: { ...draft.ai, ...saved } };
    setDraft(nextSettings);
    actions.updateSettings(nextSettings);
    return saved;
  };

  const save = async () => {
    setSaving(true);
    setAiTestResult("");
    try {
      if (user) {
        await persistAiSettings();
        notify("设置已保存到 PocketBase，模型密钥仅由服务端读取");
      } else {
        actions.updateSettings(draft);
        notify("学习偏好已保存在本机；登录后可配置服务端 AI");
      }
    } catch (error) {
      setAiTestResult(error.message || "保存 AI 设置失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  const testAi = async () => {
    if (!user) { openAccount(); return; }
    setTestingAi(true);
    setAiTestResult("");
    try {
      await persistAiSettings();
      await testAiConnection();
      setAiTestResult("连接成功，模型请求已由 PocketBase 服务端完成。");
    } catch (error) {
      setAiTestResult(error.message || "连接失败，请检查配置。");
    } finally {
      setTestingAi(false);
    }
  };

  const requestNotifications = async (enabled) => {
    if (!enabled) { update({ notifications: false }); setNotificationMessage(""); return; }
    if (!("Notification" in window)) { setNotificationMessage("当前浏览器不支持系统通知，请使用应用内的到期词汇提示。"); return; }
    const permission = await Notification.requestPermission();
    update({ notifications: permission === "granted" });
    setNotificationMessage(permission === "granted" ? "应用打开期间会在设定时间提醒。" : "通知权限被拒绝，可在浏览器网站设置中重新允许后再开启。");
    notify(permission === "granted" ? "复习提醒已开启" : "未获得通知权限");
  };

  return (
    <div className="page settings-page">
      <PageHeader title="设置" description="管理学习目标、提醒、同步和账户。" />
      <div className="settings-layout">
        <section className="settings-section open-panel"><div className="settings-heading"><GearIcon /><div><h2>学习偏好</h2><p>调整每日目标与默认阅读难度</p></div></div><label><span>每日生词目标</span><input type="number" min="1" max="50" value={draft.dailyGoal} onChange={(event) => update({ dailyGoal: Number(event.target.value) })} /></label><label><span>默认文章难度</span><select value={draft.difficulty} onChange={(event) => update({ difficulty: event.target.value })}><option>初级</option><option>中级</option><option>中高级</option><option>高级</option></select></label><label className="toggle-row"><div><span>阅读时自动收藏生词</span><small>点击高亮词汇后自动加入词汇本</small></div><input type="checkbox" checked={draft.autoSaveWords} onChange={(event) => update({ autoSaveWords: event.target.checked })} /></label></section>
        <section className="settings-section open-panel"><div className="settings-heading"><BellIcon /><div><h2>复习提醒</h2><p>仅在应用打开时检查并提醒到期词汇</p></div></div><label className="toggle-row"><div><span>浏览器通知</span><small>关闭网页后不会继续推送</small></div><input type="checkbox" checked={draft.notifications} onChange={(event) => requestNotifications(event.target.checked)} /></label><label><span>每日提醒时间</span><input type="time" value={draft.reminderTime} onChange={(event) => update({ reminderTime: event.target.value })} /></label>{notificationMessage ? <div className="recovery-notice" role="status"><span>{notificationMessage}</span></div> : null}</section>
        <section className="settings-section open-panel"><div className="settings-heading"><GlobeIcon /><div><h2>数据同步</h2><p>PocketBase · pocket.nings.top</p></div></div>{user ? <div className="sync-account"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><i className={`is-${syncStatus.kind}`}><CheckCircledIcon />{syncStatus.label}</i></div> : <div className="anonymous-state"><PersonIcon /><div><strong>当前使用本地模式</strong><span>登录后可跨设备同步学习记录。</span></div></div>}{user && ["unavailable", "partial"].includes(syncStatus.kind) ? <div className="recovery-notice" role="alert"><span>{syncStatus.label}。本地数据没有丢失。</span><button type="button" onClick={syncNow}>重试</button></div> : null}<button className="secondary-button full" type="button" onClick={user ? syncNow : openAccount}>{user ? "立即同步" : "登录或注册"}</button></section>
        <section className="settings-section ai-settings open-panel">
          <div className="settings-heading"><LightningBoltIcon /><div><h2>AI 单词识别</h2><p>配置落库，由 PocketBase 服务端请求 OpenAI 兼容模型</p></div></div>
          {!user ? <div className="recovery-notice" role="status"><span>登录后才能保存模型配置和使用服务端 AI。</span><button type="button" onClick={openAccount}>登录或注册</button></div> : null}
          <fieldset className="ai-config-fieldset" disabled={!user || loadingAi || saving || testingAi}>
            <label className="toggle-row ai-enable-row"><div><span>启用 AI 分析</span><small>文章内容由 PocketBase 服务端按需发送给模型供应商</small></div><input type="checkbox" checked={draft.ai.enabled} onChange={(event) => updateAi({ enabled: event.target.checked })} /></label>
            <div className="ai-config-grid">
              <label><span>接口地址</span><input type="url" value={draft.ai.endpoint} onChange={(event) => updateAi({ endpoint: event.target.value })} placeholder="https://api.example.com/v1" /><small>服务端仅接受 HTTPS 公网地址</small></label>
              <label><span>模型名称</span><input value={draft.ai.model} onChange={(event) => updateAi({ model: event.target.value })} placeholder="provider-model-name" /><small>使用供应商文档给出的精确模型 ID</small></label>
              <label><span>API Key</span><input type="password" value={aiKey} disabled={clearAiKey} onChange={(event) => { setAiKey(event.target.value); setClearAiKey(false); }} placeholder={aiKeyConfigured ? "已保存，留空保持不变" : "输入模型 API Key"} autoComplete="new-password" /><small><LockClosedIcon /> 服务端加密保存，不下发到浏览器</small></label>
              <label><span>最多识别</span><div className="number-with-unit"><input type="number" min="3" max="30" value={draft.ai.maxWords} onChange={(event) => updateAi({ maxWords: Number(event.target.value) })} /><em>个词</em></div><small>模型输出仍会经过原文和结构校验</small></label>
            </div>
            {aiKeyConfigured ? <button className="server-key-action" type="button" onClick={() => { setClearAiKey((value) => !value); setAiKey(""); }}>{clearAiKey ? "取消移除密钥" : "移除已保存的 API Key"}</button> : null}
            <label className="ai-prompt-field"><span>自定义分析指令</span><textarea rows="3" value={draft.ai.prompt} onChange={(event) => updateAi({ prompt: event.target.value })} placeholder={DEFAULT_AI_PROMPT} /></label>
          </fieldset>
          <div className="ai-actions"><button className="secondary-button" type="button" disabled={testingAi || saving || loadingAi} onClick={testAi}>{testingAi ? "正在通过服务端测试…" : "保存并测试连接"}</button>{aiTestResult ? <span className={aiTestResult.startsWith("连接成功") ? "is-success" : "is-error"}>{aiTestResult}</span> : <span>浏览器只请求 PocketBase，不直接连接模型供应商。</span>}</div>
        </section>
      </div><div className="settings-actions"><button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "正在保存…" : "保存设置"}</button></div>
    </div>
  );
}
