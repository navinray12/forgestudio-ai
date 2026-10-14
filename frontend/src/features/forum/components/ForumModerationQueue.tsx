import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ForumReport } from "../types/forum.types";
import { forumService } from "../services/forumService";
import { Shield, Check } from "lucide-react";

export const ForumModerationQueue: React.FC = () => {
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef(0);
  const mounted = useRef(false);

  const fetchReports = useCallback(async () => {
    const request = ++activeRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.listReports();
      if (mounted.current && request === activeRequest.current) {
        setReports(res.reports || []);
      }
    } catch (err: unknown) {
      if (mounted.current && request === activeRequest.current) {
        setError(err instanceof Error ? err.message : "Could not load moderation reports.");
      }
    } finally {
      if (mounted.current && request === activeRequest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void fetchReports();
    });
    return () => {
      mounted.current = false;
      activeRequest.current += 1;
    };
  }, [fetchReports]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Community Moderation Queue</h1>
          <p className="text-xs text-slate-400">Review flagged topics and comments to enforce guidelines</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse" />
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
          <p className="text-sm text-red-300">Moderation reports could not be loaded: {error}</p>
          <button type="button" onClick={() => void fetchReports()}
            className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
            Retry loading reports
          </button>
        </div>
      ) : reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((rep) => (
            <div key={rep.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  {rep.reason}
                </span>
                <span className="text-slate-400">{new Date(rep.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-200 font-semibold mb-1">
                Reported by {rep.reporter?.fullName || rep.reporter?.email || "User"}
              </p>
              {rep.details && <p className="text-xs text-slate-400 italic mb-3">"{rep.details}"</p>}
              {rep.topic && (
                <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-slate-300">
                  <span className="font-bold">Topic:</span> {rep.topic.title} ({rep.topic.topicNumber})
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl">
          <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-base font-bold text-slate-300">Queue Clean!</p>
          <p className="text-xs text-slate-500">There are currently no pending reports requiring moderation action.</p>
        </div>
      )}
    </div>
  );
};
