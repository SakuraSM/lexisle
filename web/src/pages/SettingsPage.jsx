import { useState } from "react";
import { BellIcon, CheckCircledIcon, GearIcon, GlobeIcon, PersonIcon } from "@radix-ui/react-icons";
import { PageHeader } from "./PagePrimitives.jsx";

export function SettingsPage({ state, actions, user, openAccount, syncStatus, syncNow, notify }) {
  const [draft, setDraft] = useState(state.settings);
  const update = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const save = () => { actions.updateSettings(draft); notify("设置已保存"); };
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
      </div><div className="settings-actions"><button className="primary-button" type="button" onClick={save}>保存设置</button></div>
    </div>
  );
}
