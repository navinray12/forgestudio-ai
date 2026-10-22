import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

const inputClass = "rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500 bg-slate-50 focus:bg-white transition";

/** Options for a select field: an array, `{ choices: [...] }`, or a comma-separated string. */
function selectChoices(options: unknown): string[] {
    const raw = Array.isArray(options) ? options
        : options && typeof options === "object" && Array.isArray((options as any).choices) ? (options as any).choices
        : typeof options === "string" ? options.split(",") : [];
    return raw.map((c: unknown) => String(c).trim()).filter(Boolean);
}

export default function CustomEntryEditor() {
    const { websiteId, cptId, entryId } = useParams();
    const navigate = useNavigate();
    const entriesPath = `/dashboard/cpts/${websiteId}/entries/${cptId}`;

    // Core Entry Data
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [status, setStatus] = useState("DRAFT");
    const [values, setValues] = useState<Record<string, any>>({});

    // Model Definitions (Fields)
    const [fields, setFields] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!cptId) return;
        let cancelled = false;
        (async () => {
            setLoading(true); setError(null); setLoadFailed(false);
            try {
                const fieldsRes = await fetch(`${apiUrl}/api/cpt/types/${cptId}/fields`, { credentials: "include" });
                const fieldsData = await fieldsRes.json().catch(() => ({}));
                if (!fieldsRes.ok || !fieldsData.success) throw new Error(fieldsData.error?.message || "Could not load this content type's fields.");
                if (cancelled) return;
                setFields(Array.isArray(fieldsData.data) ? fieldsData.data : []);

                if (entryId) {
                    // There is no single-entry endpoint; the entries list returns each entry with its values.
                    const entriesRes = await fetch(`${apiUrl}/api/cpt/types/${cptId}/entries`, { credentials: "include" });
                    const entriesData = await entriesRes.json().catch(() => ({}));
                    if (!entriesRes.ok || !entriesData.success) throw new Error(entriesData.error?.message || "Could not load the entry.");
                    const entry = (entriesData.data ?? []).find((e: any) => e.id === entryId);
                    if (!entry) throw new Error("This entry was not found. It may have been moved to trash.");
                    if (cancelled) return;
                    setTitle(entry.title ?? "");
                    setSlug(entry.slug ?? "");
                    setStatus(entry.status ?? "DRAFT");
                    setValues(entry.values && typeof entry.values === "object" ? entry.values : {});
                }
            } catch (e: any) {
                if (!cancelled) { setError(e?.message || "Could not load the editor."); setLoadFailed(true); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [cptId, entryId]);

    const setValue = (key: string, value: unknown) => setValues(prev => ({ ...prev, [key]: value }));

    const handleSave = async (e: any) => {
        e.preventDefault();
        if (loading || saving || loadFailed) return;
        if (!title.trim() || !slug.trim()) { setError("Title and slug are required."); return; }
        const missing = fields.filter(f => f.required && f.type !== "boolean" && (values[f.key] === undefined || values[f.key] === ""));
        if (missing.length > 0) { setError(`Required: ${missing.map(f => f.name).join(", ")}`); return; }
        setSaving(true); setError(null);
        try {
            const payload = { title, slug, status, values };

            const url = entryId
                ? `${apiUrl}/api/cpt/entries/${entryId}`
                : `${apiUrl}/api/cpt/types/${cptId}/entries`;

            const method = entryId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error?.message || data.message || "Failed to save the entry.");
            navigate(entriesPath);
        } catch (e: any) {
            setError(e.message || "Failed to save entry");
        } finally {
            setSaving(false);
        }
    };

    const renderField = (field: any) => {
        const value = values[field.key];
        switch (field.type) {
            case "textarea":
            case "rich-text":
                return <textarea required={field.required} rows={4} value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass} />;
            case "number":
                return <input required={field.required} type="number" value={value ?? ""} onChange={e => setValue(field.key, e.target.value === "" ? "" : Number(e.target.value))} className={`${inputClass} w-1/3`} />;
            case "email":
            case "url":
            case "date":
                return <input required={field.required} type={field.type} value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass} />;
            case "boolean":
                return (
                    <span className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={Boolean(value)} onChange={e => setValue(field.key, e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm text-slate-600">{value ? "Yes" : "No"}</span>
                    </span>
                );
            case "select": {
                const choices = selectChoices(field.options);
                return choices.length > 0 ? (
                    <select required={field.required} value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass}>
                        <option value="">Select…</option>
                        {choices.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : (
                    <input required={field.required} type="text" value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass} placeholder="Value" />
                );
            }
            case "image":
            case "file":
                return <input required={field.required} type="url" value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass} placeholder={`${field.type === "image" ? "Image" : "File"} URL`} />;
            default:
                return <input required={field.required} type="text" value={value ?? ""} onChange={e => setValue(field.key, e.target.value)} className={inputClass} placeholder={`Enter ${field.name}...`} />;
        }
    };

    const blocked = loading || saving || loadFailed;

    return (
        <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200">
                <div>
                    <Link to={entriesPath} className="text-xs font-bold text-slate-500 hover:text-slate-900">← Back to entries</Link>
                    <h1 className="text-xl font-bold text-slate-800 mt-1">{entryId ? "Edit Entry" : "Create Native Entry"}</h1>
                    <p className="text-sm text-slate-500 mt-1">Populate model data mappings.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border-slate-200 text-sm font-bold bg-slate-50">
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
                    </select>
                    <Link to={entriesPath} className="text-sm font-bold text-slate-500 hover:text-slate-900">Cancel</Link>
                    <button onClick={handleSave} disabled={blocked} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm disabled:opacity-50">
                        {saving ? "Saving…" : "Commit Entry"}
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>}

            {loading ? (
                <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
            ) : (
                <form className="flex flex-col gap-8 bg-white border border-slate-200 p-8 rounded-3xl" onSubmit={handleSave}>
                    <div className="flex flex-col gap-4">
                        <input autoFocus required placeholder="Entry Title" value={title} onChange={e => {
                            setTitle(e.target.value);
                            if (!entryId) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                        }} className="text-3xl font-bold border-none placeholder-slate-300 focus:ring-0 p-0 text-slate-800" />

                        <div className="flex items-center gap-2 text-slate-500 text-sm bg-slate-50 px-3 py-2 rounded-lg w-max border border-slate-100">
                            <span className="font-mono text-slate-400">/</span>
                            <input required value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="bg-transparent border-none p-0 h-auto focus:ring-0 text-sm font-mono text-blue-600 w-auto min-w-[200px]" placeholder="dynamic-slug" />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 w-full" />

                    <div className="flex flex-col gap-6">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Native Attributes Bound</h3>
                        {fields.length === 0 ? (
                            <div className="text-sm text-slate-500 bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center">
                                No fields are defined for this content type yet. Add fields from Custom Post Types → Manage Fields.
                            </div>
                        ) : fields.map(field => (
                            <label key={field.key} className="flex flex-col gap-2">
                                <span className="font-bold text-sm text-slate-700">{field.name} {field.required && <span className="text-red-500">*</span>}</span>
                                {renderField(field)}
                            </label>
                        ))}
                    </div>
                </form>
            )}
        </div>
    );
}
