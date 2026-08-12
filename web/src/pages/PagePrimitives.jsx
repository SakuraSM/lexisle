import { ArrowRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

export function PageHeader({ title, description, action }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      {action || null}
    </header>
  );
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span>○</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel ? <button className="primary-button" type="button" onClick={onAction}>{actionLabel}<ArrowRightIcon /></button> : null}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }) {
  return (
    <label className="search-field">
      <MagnifyingGlassIcon />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function ProgressMeter({ value, max, tone = "primary" }) {
  const ratio = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className={`meter tone-${tone}`} role="progressbar" aria-label="学习进度" aria-valuemin="0" aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={`${value}/${max}`}><i style={{ width: `${ratio}%` }} /></div>;
}
