import React, { useState, useEffect } from "react";
import {
  FolderArchive,
  FolderPlus,
  UploadCloud,
  File,
  Download,
  Trash2,
  Key,
  ShieldCheck,
  AlertTriangle,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  Lock,
  Globe,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface ObjectStoragePanelProps {
  projectId: string;
}

export const ObjectStoragePanel: React.FC<ObjectStoragePanelProps> = ({ projectId }) => {
  const [buckets, setBuckets] = useState<any[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreateBucketModal, setShowCreateBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketPolicy, setNewBucketPolicy] = useState<string>("PUBLIC_READ");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadKey, setUploadKey] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadMime, setUploadMime] = useState("text/plain");

  const [signedUrlData, setSignedUrlData] = useState<any>(null);

  useEffect(() => {
    loadBuckets();
  }, [projectId]);

  const loadBuckets = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listStorageBuckets(projectId);
      setBuckets(res.buckets || []);
      if (res.buckets?.length > 0) {
        const first = res.buckets[0].name;
        setSelectedBucket(first);
        loadObjects(first);
      } else {
        // Auto-create default assets bucket
        const created = await forgeProjectService.createStorageBucket(projectId, {
          name: "assets",
          accessPolicy: "PUBLIC_READ",
        });
        setBuckets([created.bucket]);
        setSelectedBucket(created.bucket.name);
        loadObjects(created.bucket.name);
      }
    } catch (err) {
      console.error("Failed to load storage buckets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadObjects = async (bktName: string) => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listStorageObjects(projectId, bktName);
      setObjects(res.objects || []);
    } catch (err) {
      console.error("Failed to load bucket objects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    try {
      setLoading(true);
      const res = await forgeProjectService.createStorageBucket(projectId, {
        name: newBucketName.trim(),
        accessPolicy: newBucketPolicy,
      });
      setShowCreateBucketModal(false);
      setNewBucketName("");
      setBuckets((prev) => [...prev, res.bucket]);
      setSelectedBucket(res.bucket.name);
      loadObjects(res.bucket.name);
    } catch (err: any) {
      alert(`Create bucket failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadObject = async () => {
    if (!selectedBucket || !uploadKey.trim()) return;
    try {
      setLoading(true);
      await forgeProjectService.uploadStorageObject(
        projectId,
        selectedBucket,
        uploadKey.trim(),
        uploadContent,
        uploadKey.trim(),
        uploadMime
      );
      setShowUploadModal(false);
      setUploadKey("");
      setUploadContent("");
      loadObjects(selectedBucket);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObject = async (key: string) => {
    if (!confirm(`Delete object '${key}'?`)) return;
    try {
      await forgeProjectService.deleteStorageObject(projectId, selectedBucket, key);
      loadObjects(selectedBucket);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleGenerateSignedUrl = async (key: string) => {
    try {
      const res = await forgeProjectService.generateSignedStorageUrl(
        projectId,
        selectedBucket,
        key,
        "GET",
        600
      );
      setSignedUrlData(res.signedUrl);
    } catch (err: any) {
      alert(`Signed URL failed: ${err.message}`);
    }
  };

  const activeBkt = buckets.find((b) => b.name === selectedBucket);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none p-3 gap-3">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
            <FolderArchive className="w-4 h-4 text-cyan-400" />
            <span>Bucket:</span>
          </span>
          <select
            value={selectedBucket}
            onChange={(e) => {
              setSelectedBucket(e.target.value);
              loadObjects(e.target.value);
            }}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-medium"
          >
            {buckets.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} ({b.objectCount || 0} files)
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateBucketModal(true)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>New Bucket</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeBkt && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mr-2">
              {activeBkt.accessPolicy === "PUBLIC_READ" ? (
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{activeBkt.accessPolicy}</span>
              <span className="text-slate-600">•</span>
              <span>{(activeBkt.currentSizeBytes / 1024).toFixed(1)} KB used</span>
            </span>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* Objects Grid / List */}
      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-lg">
        {objects.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 sticky top-0">
                <th className="p-2.5 font-semibold text-slate-300">File Key</th>
                <th className="p-2.5 font-semibold text-slate-300">MIME Type</th>
                <th className="p-2.5 font-semibold text-slate-300">Size</th>
                <th className="p-2.5 font-semibold text-slate-300">Scan Status</th>
                <th className="p-2.5 font-semibold text-slate-300">Updated</th>
                <th className="p-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {objects.map((obj) => (
                <tr key={obj.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-2.5 text-cyan-300 font-semibold flex items-center gap-1.5 font-sans">
                    <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{obj.key}</span>
                  </td>
                  <td className="p-2.5 text-slate-400">{obj.mimeType}</td>
                  <td className="p-2.5 text-slate-300">{(obj.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{obj.scanStatus}</span>
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-500 font-sans">{new Date(obj.updatedAt).toLocaleDateString()}</td>
                  <td className="p-2.5 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleGenerateSignedUrl(obj.key)}
                        className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-amber-950/40"
                        title="Generate Time-Limited Signed URL"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteObject(obj.key)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40"
                        title="Delete Object"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <FolderArchive className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-400">No objects in bucket '{selectedBucket}'</p>
            <p className="text-xs text-slate-500 mt-1">Upload a file or asset to get started.</p>
          </div>
        )}
      </div>

      {/* MODAL: Create Bucket */}
      {showCreateBucketModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-200">Create Storage Bucket</span>
              <button onClick={() => setShowCreateBucketModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Bucket Name</label>
              <input
                type="text"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="e.g. user-uploads, media"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Access Policy</label>
              <select
                value={newBucketPolicy}
                onChange={(e) => setNewBucketPolicy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              >
                <option value="PUBLIC_READ">PUBLIC_READ (Public Web Delivery)</option>
                <option value="PRIVATE">PRIVATE (Signed URLs Only)</option>
                <option value="AUTHENTICATED">AUTHENTICATED (Workspace Users)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCreateBucketModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBucket}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                Create Bucket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Upload Object */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-200">Upload Object to {selectedBucket}</span>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Object Key / Path</label>
              <input
                type="text"
                value={uploadKey}
                onChange={(e) => setUploadKey(e.target.value)}
                placeholder="e.g. documents/guide.pdf, images/logo.png"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">MIME Type</label>
              <input
                type="text"
                value={uploadMime}
                onChange={(e) => setUploadMime(e.target.value)}
                placeholder="e.g. application/json, text/plain"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">File Content (Text or Base64)</label>
              <textarea
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Enter text or string content to write to storage..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadObject}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Signed URL Display */}
      {signedUrlData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Signed Access URL (Expires in {signedUrlData.expiresInSeconds}s)</span>
              </span>
              <button onClick={() => setSignedUrlData(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Signed URL</label>
              <textarea
                readOnly
                value={signedUrlData.url}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-cyan-300 font-mono select-all"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(signedUrlData.url);
                  alert("Signed URL copied to clipboard!");
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Signed URL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
