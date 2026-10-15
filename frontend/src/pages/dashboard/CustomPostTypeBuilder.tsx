import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function CustomPostTypeBuilder() {
    const { websiteId, cptId } = useParams();
    const navigate = useNavigate();

    // CPT Form Data
    const [name, setName] = useState("");
    const [singular, setSingular] = useState("");
    const [plural, setPlural] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");

    // Drag & Drop Field Schemas (Simplified mapping for boundaries)
    const [fields, setFields] = useState<any[]>([]);

    const [saving, setSaving] = useState(false);
    // A successful type creation must survive a later field-save failure.
    // Retrying against the same ID prevents duplicate post types.
    const [createdCptId, setCreatedCptId] = useState<string | null>(null);
    const [loading, setLoading] = useState(Boolean(cptId));
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedNotice, setSavedNotice] = useState<string | null>(null);

    useEffect(() => {
        if (!cptId || !websiteId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        const load = async () => {
            try {
                const [typesResponse, fieldsResponse] = await Promise.all([
                    fetch(`${apiUrl}/api/cpt/websites/${websiteId}/types`, { credentials: "include" }),
                    fetch(`${apiUrl}/api/cpt/types/${cptId}/fields`, { credentials: "include" }),
                ]);
                if (!typesResponse.ok || !fieldsResponse.ok) throw new Error("Could not load the existing content type.");
                const [typesResult, fieldsResult] = await Promise.all([typesResponse.json(), fieldsResponse.json()]);
                if (!typesResult.success || !fieldsResult.success) throw new Error("The existing content type could not be loaded.");
                const matchingType = (typesResult.data as any[]).find((item) => item.id === cptId);
                if (!matchingType) throw new Error("Content type not found or access denied.");
                if (cancelled) return;
                setName(matchingType.name ?? "");
                setSingular(matchingType.singular ?? "");
                setPlural(matchingType.plural ?? "");
                setSlug(matchingType.slug ?? "");
                setDescription(matchingType.description ?? "");
                setFields(fieldsResult.data);
            } catch (error: any) {
                if (!cancelled) setLoadError(error?.message || "Unable to load saved fields.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [cptId, websiteId]);

    const handleAddField = () => {
        setFields(prev => [...prev, {
            name: "New Field",
            key: `field_${Date.now()}`,
            type: "text",
            required: false,
            options: {}
        }]);
    };

    const handleSave = async (e: any) => {
        e.preventDefault();
        if (loading || loadError) return;
        setSaveError(null);
        setSavedNotice(null);
        setSaving(true);
        try {

            // 1. Create CPT
            let currentCptId = cptId || createdCptId;
            if (!currentCptId) {
                const res = await fetch(`${apiUrl}/api/cpt/websites/${websiteId}/types`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name, singular, plural, slug, description, hasArchive: true })
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.success || !data?.data?.id) {
                    throw new Error(data?.error?.message || "Could not create this content type");
                }
                currentCptId = data.data.id;
                setCreatedCptId(currentCptId);
            }

            // 2. Save Fields Sync
            const fieldsResponse = await fetch(`${apiUrl}/api/cpt/types/${currentCptId}/fields`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ fields })
            });
            const fieldsResult = await fieldsResponse.json().catch(() => null);
            if (!fieldsResponse.ok || !fieldsResult?.success) {
                throw new Error(fieldsResult?.error?.message || fieldsResult?.message || "Fields were not saved. Please review and retry.");
            }
            setFields(fieldsResult.data);
            if (fieldsResult.migrationPlan?.retained?.length) {
                setSavedNotice(`Saved. Protected existing fields retained: ${fieldsResult.migrationPlan.retained.join(", ")}.`);
            } else {
                navigate(`/dashboard/cpts/${websiteId}`);
            }
        } catch (e: any) {
            setSaveError(e.message || "Failed to commit changes");
        } finally {
            setSaving(false);
        }
    };

    const isNew = !cptId && !createdCptId;

    return (
        <div className="p-8 max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl sticky top-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">{isNew ? "Create Post Type" : "Edit Post Type"}</h2>

                    <form id="cpt-form" onSubmit={handleSave} className="flex flex-col gap-4">
                        <label className="text-sm font-bold text-slate-700">Display Name
                            <input disabled={!isNew} required value={name} onChange={e => setName(e.target.value)} type="text" className="mt-1 block w-full rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="e.g. Portfolio" />
                        </label>

                        <div className="flex gap-4">
                            <label className="text-sm font-bold text-slate-700 w-1/2">Singular
                                <input disabled={!isNew} required value={singular} onChange={e => setSingular(e.target.value)} type="text" className="mt-1 block w-full rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="Project" />
                            </label>
                            <label className="text-sm font-bold text-slate-700 w-1/2">Plural
                                <input disabled={!isNew} required value={plural} onChange={e => setPlural(e.target.value)} type="text" className="mt-1 block w-full rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="Projects" />
                            </label>
                        </div>

                        <label className="text-sm font-bold text-slate-700">URL Slug <span className="font-normal text-xs text-slate-500 ml-1">(Must be unique)</span>
                            <input disabled={!isNew} required pattern="^[a-z0-9-]+$" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} type="text" className="mt-1 font-mono block w-full rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="portfolio" />
                        </label>

                        <label className="text-sm font-bold text-slate-700">Internal Description
                            <textarea disabled={!isNew} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded-xl border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="Internal context for this content type..." />
                        </label>

                        {loading && <p role="status" className="text-sm text-slate-600">Loading saved fields…</p>}
                        {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
                        {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
                        {createdCptId && (
                            <p role="status" className="text-sm text-amber-700">
                                Content type created; field configuration still needs saving. Retry will update this content type, not create another.
                            </p>
                        )}
                        {savedNotice && <p role="status" className="text-sm text-amber-700">{savedNotice}</p>}
                        <button disabled={saving || loading || Boolean(loadError)} type="submit" className="mt-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                            {saving ? "Committing..." : "Save Configuration"}
                        </button>
                    </form>
                </div>
            </div>

            <div className="w-full lg:w-2/3">
                <div className="bg-white border border-slate-200 p-8 rounded-3xl min-h-[600px]">
                    <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-5">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Fields Builder</h2>
                            <p className="text-sm text-slate-500 mt-1">Design the architectural data model. This structures Editor dynamic bindings.</p>
                        </div>
                        <button onClick={handleAddField} disabled={loading || Boolean(loadError)} className="bg-slate-800 text-white px-4 py-2 text-xs font-bold rounded-xl hover:bg-slate-900 transition">+ Add Native Field</button>
                    </div>

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={index} className="flex gap-4 items-center bg-slate-50 border border-slate-200 p-4 rounded-xl group">
                                <div className="flex-1 grid grid-cols-3 gap-4">
                                    <input
                                        value={field.name}
                                        onChange={e => {
                                            const newFields = [...fields];
                                            newFields[index].name = e.target.value;
                                            if (isNew) newFields[index].key = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                            setFields(newFields);
                                        }}
                                        placeholder="Display Name"
                                        className="rounded-lg border-slate-200 p-2 text-sm"
                                    />
                                    <input
                                        value={field.key}
                                        onChange={e => {
                                            const newFields = [...fields];
                                            newFields[index].key = e.target.value;
                                            setFields(newFields);
                                        }}
                                        placeholder="system_key"
                                        className="rounded-lg border-slate-200 p-2 text-sm font-mono"
                                    />
                                    <select
                                        value={field.type}
                                        onChange={e => {
                                            const newFields = [...fields];
                                            newFields[index].type = e.target.value;
                                            setFields(newFields);
                                        }}
                                        className="rounded-lg border-slate-200 p-2 text-sm"
                                    >
                                        <option value="text">Text (String)</option>
                                        <option value="rich-text">Rich Text (HTML)</option>
                                        <option value="image">Image / Media</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                    </select>
                                </div>
                                {field.id ? (
                                    <span className="text-xs text-slate-500" title="Saved fields cannot be removed by an ordinary schema save.">Preserved</span>
                                ) : (
                                    <button type="button" onClick={() => setFields(fields.filter((_, i) => i !== index))} className="text-red-500 hover:bg-red-50 p-2 rounded-lg font-bold text-xs transition">Remove draft</button>
                                )}
                            </div>
                        ))}
                        <p className="text-xs text-slate-500">Saved fields keep their stable IDs. Existing fields are preserved; deleting a stored field requires an approved migration.</p>
                        {!isNew && (
                            <p className="text-xs text-amber-700" role="note">
                                Once entries exist (including drafts or trash), changing a saved field key or type, or making a field newly required, needs a reviewed schema migration/backfill. Other field edits remain available.
                            </p>
                        )}
                        {fields.length === 0 && (
                            <div className="text-center py-20 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                                Inject your architectural fields natively above.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
