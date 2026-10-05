import React, { useState, useEffect } from "react";
import {
  Link2,
  Search,
  CheckCircle,
  XCircle,
  RotateCw,
  Globe,
  ShieldCheck,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  ArrowRight,
  Server,
  Layers,
  Copy,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface DomainPanelProps {
  projectId: string;
}

export const DomainPanel: React.FC<DomainPanelProps> = ({ projectId }) => {
  const [domains, setDomains] = useState<any[]>([]);
  const [activeDomain, setActiveDomain] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // New domain form
  const [newDomain, setNewDomain] = useState("");
  const [newEnv, setNewEnv] = useState<"preview" | "staging" | "production">("production");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [configuringDns, setConfiguringDns] = useState(false);
  const [detaching, setDetaching] = useState(false);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const res = await forgeProjectService.listDomains(projectId);
      setDomains(res.domains || []);
      if (res.domains && res.domains.length > 0) {
        setActiveDomain(res.domains[0]);
      } else {
        setActiveDomain(null);
      }
    } catch (e) {
      console.warn("Could not load domains:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, [projectId]);

  const handleSearchAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await forgeProjectService.checkDomainAvailability(searchQuery.trim());
      setSearchResult(res.availability);
    } catch (err: any) {
      alert(`Domain check failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleConnectDomain = async (domainName?: string) => {
    const domainToConnect = domainName || newDomain.trim();
    if (!domainToConnect) return;
    try {
      setConnecting(true);
      const res = await forgeProjectService.connectDomain(projectId, {
        domain: domainToConnect,
        provider: "godaddy",
        environment: newEnv,
      });
      alert(`Domain ${domainToConnect} connected! Next step: configure DNS and verify ownership.`);
      setNewDomain("");
      setSearchResult(null);
      await loadDomains();
      setActiveDomain(res.customDomain);
    } catch (err: any) {
      alert(`Failed to connect domain: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleConfigureDns = async () => {
    if (!activeDomain) return;
    try {
      setConfiguringDns(true);
      const res = await forgeProjectService.configureDomainDns(projectId, activeDomain.id, {
        preserveExisting: true,
      });
      alert(`GoDaddy DNS configured safely! Forge routing records created without touching customer MX/mail records.`);
      await loadDomains();
    } catch (err: any) {
      alert(`DNS configuration error: ${err.message}`);
    } finally {
      setConfiguringDns(false);
    }
  };

  const handleVerifyOwnership = async () => {
    if (!activeDomain) return;
    try {
      setVerifying(true);
      const res = await forgeProjectService.verifyDomainOwnership(projectId, activeDomain.id);
      if (res.verified) {
        alert("Domain ownership verified successfully! SSL certificate provisioning initiated.");
      } else {
        alert(`Ownership check pending. Token '${activeDomain.verificationToken}' not found in DNS TXT record yet.`);
      }
      await loadDomains();
    } catch (err: any) {
      alert(`Verification error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleDetach = async () => {
    if (!activeDomain) return;
    if (!confirm(`Are you sure you want to detach '${activeDomain.domain}' from this project? Unrelated DNS records will be preserved.`)) return;
    try {
      setDetaching(true);
      await forgeProjectService.detachDomain(projectId, activeDomain.id);
      alert(`Domain ${activeDomain.domain} detached.`);
      await loadDomains();
    } catch (err: any) {
      alert(`Detach failed: ${err.message}`);
    } finally {
      setDetaching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header & Search Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-100">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>GoDaddy & Custom Domain Automation</span>
          </div>
        </div>

        {/* GoDaddy Domain Availability Search */}
        <form onSubmit={handleSearchAvailability} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search GoDaddy domain availability..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded pl-7 pr-3 py-1 text-xs text-slate-200 w-64 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
          >
            {searching ? "Checking..." : "Check"}
          </button>
        </form>
      </div>

      {/* Domain Search Results Banner */}
      {searchResult && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{searchResult.domain}</span>
            {searchResult.available ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                AVAILABLE (${searchResult.price || 12.99}/yr)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/40">
                UNAVAILABLE
              </span>
            )}
          </div>
          {searchResult.available && (
            <button
              onClick={() => handleConnectDomain(searchResult.domain)}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
            >
              <Plus className="w-3 h-3" />
              <span>Connect & Register</span>
            </button>
          )}
        </div>
      )}

      {/* Main Split: Domain List & Active Domain Configuration */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Connected Domains */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Configured Domains ({domains.length})</span>
            <button
              onClick={loadDomains}
              disabled={loading}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
            >
              <RotateCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="domain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={newEnv}
                onChange={(e: any) => setNewEnv(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="production">Prod</option>
                <option value="staging">Staging</option>
                <option value="preview">Preview</option>
              </select>
              <button
                onClick={() => handleConnectDomain()}
                disabled={connecting || !newDomain.trim()}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-medium transition disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {domains.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No custom domains connected yet.
              </div>
            ) : (
              domains.map((dom) => (
                <div
                  key={dom.id}
                  onClick={() => setActiveDomain(dom)}
                  className={`p-2.5 cursor-pointer text-xs transition ${
                    activeDomain?.id === dom.id
                      ? "bg-slate-800/80 border-l-2 border-emerald-500"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                      {dom.domain}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        dom.status === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : dom.status === "VERIFYING"
                          ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {dom.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="capitalize">{dom.provider}</span>
                    <span className="font-mono uppercase">{dom.environment}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Domain Inspection, Verification & DNS Records */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {activeDomain ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Domain Header Card */}
              <div className="p-4 bg-slate-900 border-b border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-100 font-mono">
                        {activeDomain.domain}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase">
                        {activeDomain.environment}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          activeDomain.sslStatus === "ACTIVE"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : "bg-amber-950 text-amber-400 border border-amber-800/40"
                        }`}
                      >
                        SSL: {activeDomain.sslStatus}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Provider: <span className="text-slate-200 capitalize">{activeDomain.provider}</span> | Verification Token:{" "}
                      <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded font-mono text-[11px]">
                        {activeDomain.verificationToken}
                      </code>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfigureDns}
                      disabled={configuringDns}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                      title="Configure GoDaddy DNS automatically"
                    >
                      <Server className="w-3 h-3" />
                      <span>{configuringDns ? "Configuring..." : "Configure GoDaddy DNS"}</span>
                    </button>

                    <button
                      onClick={handleVerifyOwnership}
                      disabled={verifying}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
                      title="Check TXT Verification Record in DNS"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>{verifying ? "Checking..." : "Verify Ownership"}</span>
                    </button>

                    <button
                      onClick={handleDetach}
                      disabled={detaching}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800/50 text-rose-300 rounded text-xs transition"
                      title="Detach domain from project"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Detach</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* DNS Records Configuration Table */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Required Forge DNS Records (Mail & MX records strictly preserved)</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {activeDomain.dnsRecords?.length || 0} records
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="py-2 px-3 font-semibold">TYPE</th>
                        <th className="py-2 px-3 font-semibold">NAME / HOST</th>
                        <th className="py-2 px-3 font-semibold">DATA / TARGET</th>
                        <th className="py-2 px-3 font-semibold">PURPOSE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                      {(activeDomain.dnsRecords || []).map((rec: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-cyan-400 font-semibold">{rec.type}</td>
                          <td className="py-2 px-3 text-slate-200">{rec.name}</td>
                          <td className="py-2 px-3 text-emerald-400 font-medium">{rec.data}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans text-xs">
                            {rec.type === "TXT"
                              ? "Ownership Verification"
                              : rec.name === "@"
                              ? "Apex Edge Routing"
                              : "Subdomain Edge CNAME"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a domain or add a new custom domain.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
