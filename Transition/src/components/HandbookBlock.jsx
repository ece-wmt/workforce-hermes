import { Icon } from "./handbookIcons";
import HandbookChart from "./HandbookChart";

const WIDTH_OPTS = [
  { w: 2, label: "⅓" },
  { w: 3, label: "½" },
  { w: 4, label: "⅔" },
  { w: 6, label: "Full" },
];

const HEADING_ICONS = ["book", "layers", "steps", "timeline", "callout", "cardgrid", "kpi", "chart"];

export default function HandbookBlock({
  block, editing, index, total, isDragOver,
  onUpdate, onSetWidth, onRemove, onDuplicate, onMove,
  onDragStart, onDragEnterBlock, onDropBlock, onDragEnd,
}) {
  const { type, props } = block;
  const isBanner = type === "banner";

  return (
    <div
      className={`hb-block w-${block.w} ${isBanner ? "hb-banner" : ""} ${type === "callout" ? "hb-callout" : ""} ${isDragOver ? "drag-over" : ""}`}
      onDragOver={editing ? (e) => e.preventDefault() : undefined}
      onDragEnter={editing ? onDragEnterBlock : undefined}
      onDrop={editing ? (e) => { e.preventDefault(); onDropBlock(); } : undefined}
    >
      {editing && (
        <div className="hb-block-toolbar">
          <button
            className="hb-tool-btn hb-drag-handle"
            title="Drag to reorder"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          ><Icon name="grip" size={14} /></button>
          <div className="hb-width-seg" title="Block width">
            {WIDTH_OPTS.map((o) => (
              <button key={o.w} className={block.w === o.w ? "active" : ""} onClick={() => onSetWidth(o.w)}>{o.label}</button>
            ))}
          </div>
          <button className="hb-tool-btn" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="up" size={14} /></button>
          <button className="hb-tool-btn" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><Icon name="down" size={14} /></button>
          <button className="hb-tool-btn" title="Duplicate" onClick={onDuplicate}><Icon name="copy" size={13} /></button>
          <button className="hb-tool-btn danger" title="Delete" onClick={onRemove}><Icon name="trash" size={13} /></button>
        </div>
      )}

      <BlockContent type={type} props={props} editing={editing} onUpdate={onUpdate} />
    </div>
  );
}

function BlockContent({ type, props, editing, onUpdate }) {
  switch (type) {
    case "banner":
      return editing ? (
        <>
          <input className="hb-edit-input" style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: 8 }} value={props.title} placeholder="Banner title" onChange={(e) => onUpdate({ title: e.target.value })} />
          <input className="hb-edit-input" value={props.subtitle} placeholder="Subtitle" onChange={(e) => onUpdate({ subtitle: e.target.value })} />
        </>
      ) : (
        <>
          <h1><Icon name="layers" size={22} />{props.title}</h1>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </>
      );

    case "heading":
      return editing ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="hb-edit-input" style={{ width: 70 }} value={props.icon || "book"} onChange={(e) => onUpdate({ icon: e.target.value })}>
            {HEADING_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <input className="hb-edit-input" style={{ fontWeight: 800 }} value={props.text} placeholder="Heading text" onChange={(e) => onUpdate({ text: e.target.value })} />
        </div>
      ) : (
        <h3 className="hb-heading"><Icon name={props.icon || "book"} size={20} />{props.text}</h3>
      );

    case "text":
      return editing ? (
        <textarea className="hb-edit-area" rows={5} value={props.body} placeholder="Write your content…" onChange={(e) => onUpdate({ body: e.target.value })} />
      ) : (
        <div className="hb-text">{props.body}</div>
      );

    case "callout":
      return editing ? (
        <div style={{ flex: 1 }}>
          <div className="hb-mini-label">Callout title</div>
          <input className="hb-edit-input" value={props.title} placeholder="Title" onChange={(e) => onUpdate({ title: e.target.value })} />
          <div className="hb-mini-label">Body</div>
          <textarea className="hb-edit-area" rows={2} value={props.body} placeholder="Reminder text" onChange={(e) => onUpdate({ body: e.target.value })} />
        </div>
      ) : (
        <>
          <span className="ic"><Icon name="callout" size={20} /></span>
          <div>
            <div className="hb-callout-title">{props.title}</div>
            <div className="hb-callout-body">{props.body}</div>
          </div>
        </>
      );

    case "timeline":
      return <ListEditor
        editing={editing}
        items={props.items || []}
        fields={[{ key: "title", placeholder: "Step title" }, { key: "desc", placeholder: "Description", area: true }]}
        onChange={(items) => onUpdate({ items })}
        render={(items) => (
          <ul className="hb-timeline">
            {items.map((it, i) => (
              <li key={i} className="hb-timeline-item">
                <div className="hb-timeline-title">{it.title}</div>
                <div className="hb-timeline-desc">{it.desc}</div>
              </li>
            ))}
          </ul>
        )}
        newItem={{ title: "New step", desc: "" }}
      />;

    case "steps":
      return <ListEditor
        editing={editing}
        items={props.items || []}
        fields={[{ key: "title", placeholder: "Step title" }, { key: "desc", placeholder: "Description", area: true }]}
        onChange={(items) => onUpdate({ items })}
        render={(items) => (
          <div className="hb-steps">
            {items.map((it, i) => (
              <div key={i} className="hb-step">
                <div className="hb-step-num">{i + 1}</div>
                <div>
                  <div className="hb-step-title">{it.title}</div>
                  <div className="hb-step-desc">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        newItem={{ title: "New step", desc: "" }}
      />;

    case "cardgrid":
      return <ListEditor
        editing={editing}
        items={props.columns || []}
        fields={[{ key: "title", placeholder: "Card title" }, { key: "body", placeholder: "Card body", area: true }]}
        onChange={(columns) => onUpdate({ columns })}
        render={(columns) => (
          <div className="hb-cardgrid">
            {columns.map((c, i) => (
              <div key={i} className="hb-subcard">
                <div className="sc-icon"><Icon name={c.icon || "layers"} size={20} /></div>
                <div className="sc-title">{c.title}</div>
                <div className="sc-body">{c.body}</div>
              </div>
            ))}
          </div>
        )}
        newItem={{ icon: "layers", title: "New Card", body: "" }}
      />;

    case "kpis":
      return <ListEditor
        editing={editing}
        items={props.items || []}
        fields={[{ key: "value", placeholder: "Value" }, { key: "label", placeholder: "Label" }]}
        onChange={(items) => onUpdate({ items })}
        render={(items) => (
          <div className="hb-kpis">
            {items.map((k, i) => (
              <div key={i} className="hb-kpi">
                <div className="hb-kpi-value">{k.value}</div>
                <div className="hb-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
        )}
        newItem={{ value: "0", label: "Metric" }}
      />;

    case "chart":
      return <ChartEditor props={props} editing={editing} onUpdate={onUpdate} />;

    case "image":
      return editing ? (
        <div>
          <div className="hb-mini-label">Image URL</div>
          <input className="hb-edit-input" value={props.url} placeholder="https://…" onChange={(e) => onUpdate({ url: e.target.value })} />
          <div className="hb-mini-label">Alt text</div>
          <input className="hb-edit-input" value={props.alt} placeholder="Describe the image" onChange={(e) => onUpdate({ alt: e.target.value })} />
          {props.url ? <div className="hb-image-wrap" style={{ marginTop: 10 }}><img src={props.url} alt={props.alt} /></div> : null}
        </div>
      ) : props.url ? (
        <div className="hb-image-wrap"><img src={props.url} alt={props.alt} /></div>
      ) : (
        <div className="hb-image-empty"><Icon name="image" size={28} />No image set</div>
      );

    case "divider":
      return <hr className="hb-divider-line" />;

    default:
      return <div className="hb-text">{JSON.stringify(props)}</div>;
  }
}

/* Generic add/remove/edit list of objects with text fields. */
function ListEditor({ editing, items, fields, onChange, render, newItem }) {
  if (!editing) return render(items);

  function patch(i, key, val) {
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it));
    onChange(next);
  }
  function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, { ...newItem }]); }
  function move(i, dir) {
    const t = i + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ border: "1px dashed var(--glass-border)", borderRadius: 10, padding: 10, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
            <button className="hb-tool-btn" title="Up" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={12} /></button>
            <button className="hb-tool-btn" title="Down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={12} /></button>
            <button className="hb-tool-btn danger" title="Remove" onClick={() => remove(i)}><Icon name="trash" size={12} /></button>
          </div>
          {fields.map((f) => (
            f.area ? (
              <textarea key={f.key} className="hb-edit-area" style={{ marginBottom: 6 }} rows={2} value={it[f.key] || ""} placeholder={f.placeholder} onChange={(e) => patch(i, f.key, e.target.value)} />
            ) : (
              <input key={f.key} className="hb-edit-input" style={{ marginBottom: 6 }} value={it[f.key] || ""} placeholder={f.placeholder} onChange={(e) => patch(i, f.key, e.target.value)} />
            )
          ))}
        </div>
      ))}
      <button className="hb-btn hb-btn-ghost" style={{ justifyContent: "center" }} onClick={add}><Icon name="plus" size={14} /> Add item</button>
    </div>
  );
}

function ChartEditor({ props, editing, onUpdate }) {
  if (!editing) return <HandbookChart kind={props.kind} title={props.title} data={props.data} />;

  const data = props.data || [];
  function patch(i, key, val) {
    onUpdate({ data: data.map((d, idx) => (idx === i ? { ...d, [key]: key === "value" ? val : val } : d)) });
  }
  function remove(i) { onUpdate({ data: data.filter((_, idx) => idx !== i) }); }
  function add() { onUpdate({ data: [...data, { label: "Item", value: 1 }] }); }

  return (
    <div>
      <div className="hb-mini-label">Chart title</div>
      <input className="hb-edit-input" value={props.title || ""} placeholder="Chart title" onChange={(e) => onUpdate({ title: e.target.value })} />
      <div className="hb-mini-label">Chart type</div>
      <select className="hb-edit-input" value={props.kind} onChange={(e) => onUpdate({ kind: e.target.value })}>
        <option value="bar">Bar</option>
        <option value="pie">Pie</option>
        <option value="line">Line</option>
        <option value="progress">Progress bars</option>
      </select>
      <div className="hb-mini-label">Data points</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <input className="hb-edit-input" style={{ flex: 2 }} value={d.label} placeholder="Label" onChange={(e) => patch(i, "label", e.target.value)} />
            <input className="hb-edit-input" style={{ flex: 1 }} type="number" value={d.value} placeholder="Value" onChange={(e) => patch(i, "value", Number(e.target.value))} />
            <button className="hb-tool-btn danger" onClick={() => remove(i)}><Icon name="trash" size={12} /></button>
          </div>
        ))}
        <button className="hb-btn hb-btn-ghost" style={{ justifyContent: "center" }} onClick={add}><Icon name="plus" size={14} /> Add point</button>
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--glass-border)" }}>
        <HandbookChart kind={props.kind} title={props.title} data={props.data} />
      </div>
    </div>
  );
}
