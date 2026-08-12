import { useEffect, useState } from "react";
import { FileTextIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { EmptyState, PageHeader, SearchField } from "./PagePrimitives.jsx";

const blankNote = { id: "", title: "", body: "", tags: [] };

export function NotesPage({ state, actions, notify }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(state.notes[0]?.id || "new");
  const selected = state.notes.find((note) => note.id === selectedId);
  const [draft, setDraft] = useState(selected || blankNote);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => { setDraft(selected || blankNote); }, [selected]);
  const notes = state.notes.filter((note) => !query || `${note.title} ${note.body} ${note.tags.join(" ")}`.includes(query));
  const save = () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    actions.saveNote({ ...draft, title: draft.title.trim() || "未命名笔记" });
    notify("笔记已保存");
  };
  const remove = () => {
    if (!selected) return;
    actions.deleteNote(selected.id);
    setSelectedId("new");
    notify("笔记已删除");
    setConfirmingDelete(false);
  };

  return (
    <div className="page notes-page">
      <PageHeader title="笔记" description="记录文章洞察、例句和自己的理解。" action={<button className="primary-button" type="button" onClick={() => setSelectedId("new")}><PlusIcon />新建笔记</button>} />
      <div className="notes-layout">
        <aside className="note-list open-panel"><SearchField value={query} onChange={setQuery} placeholder="搜索笔记" />{notes.length ? notes.map((note) => <button key={note.id} className={selectedId === note.id ? "is-active" : ""} type="button" onClick={() => setSelectedId(note.id)}><FileTextIcon /><div><strong>{note.title}</strong><span>{note.body.slice(0, 46) || "空笔记"}</span><small>{new Date(note.updatedAt).toLocaleDateString("zh-CN")}</small></div></button>) : <EmptyState title="还没有笔记" description="阅读时写下你的理解。" />}</aside>
        <section className="note-editor open-panel"><div className="editor-toolbar"><span>{selected ? "编辑笔记" : "新笔记"}</span>{selected ? <button className="danger-link" type="button" onClick={() => setConfirmingDelete(true)}><TrashIcon />删除</button> : null}</div>{confirmingDelete ? <div className="inline-confirm" role="alert"><p>删除后会同步到其他设备，是否继续？</p><div><button type="button" onClick={() => setConfirmingDelete(false)}>取消</button><button className="danger-link" type="button" onClick={remove}>确认删除</button></div></div> : null}<label className="sr-only" htmlFor="note-title">笔记标题</label><input id="note-title" className="note-title-input" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="笔记标题" /><label className="sr-only" htmlFor="note-body">笔记内容</label><textarea id="note-body" value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="用自己的话记录理解、摘录例句或提出问题……" /><label className="tag-input"><span>标签</span><input value={draft.tags.join("、")} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean) }))} placeholder="睡眠、记忆" /></label><div className="editor-footer"><span>{draft.body.length} 字</span><button className="primary-button" type="button" onClick={save}>保存笔记</button></div></section>
      </div>
    </div>
  );
}
