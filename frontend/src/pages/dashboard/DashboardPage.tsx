import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Folder,
  FolderPlus,
  FileText,
  Grid2X2,
  LibraryBig,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Plug,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import MembersView from "../../features/workspaces/MembersView";
import UsageView from "../../features/usage/UsageView";
import "./DashboardPage.css";

interface Website {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "grid" | "list";
type DashboardSection = "sites" | "archive" | "members" | "usage";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const folderStorageKey = "forgestudio.dashboard.folders";

const navItems = [
  { label: "Sites", icon: LayoutGrid, section: "sites" as DashboardSection },
  { label: "Archive", icon: Archive, section: "archive" as DashboardSection },
];

const secondaryItems = [
  { label: "Members", icon: Users, section: "members" as DashboardSection },
  { label: "Plans", icon: Sparkles, section: "plans" as const },
  { label: "Usage", icon: Grid2X2, section: "usage" as const },
  { label: "Forms", icon: FileText, section: "forms" as const },
  { label: "Billing", icon: Folder, section: "billing" as const },
  { label: "Integrations", icon: Plug, section: "integrations" as const, expandable: true },
  { label: "Libraries & Templates", icon: LibraryBig, section: "libraries" as const, expandable: true },
];

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${days} days ago`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FS";
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<DashboardSection>("sites");
  const [websites, setWebsites] = useState<Website[]>([]);
  const [archivedWebsites, setArchivedWebsites] = useState<Website[]>([]);
  const [folders, setFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(folderStorageKey) || "[]") as string[]; } catch { return []; }
  });
  const [activeFolder, setActiveFolder] = useState("All sites");
  const [search, setSearch] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchWebsites = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/websites`, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || data?.error?.message || "Unable to load sites.");
      setWebsites(Array.isArray(data?.websites) ? data.websites : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load sites.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchArchive = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/websites/trash/list`, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (response.ok) setArchivedWebsites(Array.isArray(data?.websites) ? data.websites : Array.isArray(data?.items) ? data.items : []);
    } catch { /* Archive is optional when the server has no trashed sites. */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchWebsites(); void fetchArchive(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchArchive, fetchWebsites]);
  useEffect(() => { localStorage.setItem(folderStorageKey, JSON.stringify(folders)); }, [folders]);

  const visibleWebsites = useMemo(() => {
    const source = section === "archive" ? archivedWebsites : websites;
    return [...source]
      .filter((site) => site.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt).getTime();
        const bDate = new Date(b.updatedAt || b.createdAt).getTime();
        return sortNewestFirst ? bDate - aDate : aDate - bDate;
      });
  }, [archivedWebsites, search, section, sortNewestFirst, websites]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!siteName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/websites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.website?.id) throw new Error(data?.message || data?.error?.message || "Unable to create site.");
      setCreateOpen(false);
      setSiteName("");
      navigate(`/editor/${data.website.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create site.");
    } finally { setCreating(false); }
  };

  const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };
  const addFolder = () => {
    const name = window.prompt("Folder name");
    if (name?.trim() && !folders.includes(name.trim())) setFolders((current) => [...current, name.trim()]);
  };

  const displayName = user?.fullName?.trim() || user?.email?.split("@")[0] || "Partha";
  const currentSites = section === "archive" ? archivedWebsites : websites;

  return (
    <div className="studio-dashboard">
      <header className="studio-header">
        <Link to="/dashboard" className="studio-brand">web studio</Link>
        <div className="header-divider" />
        <div className="header-actions">
          <button className="icon-button header-undo" aria-label="Undo"><Undo2 size={16} /></button>
          <button className="icon-button header-undo" aria-label="Redo"><Undo2 size={16} className="redo-icon" /></button>
          <button className="icon-button notification-button" aria-label="Notifications"><Bell size={16} /><span className="notification-dot" /></button>
          <Link className="upgrade-button" to="/subscriptions">Upgrade <span>→</span></Link>
          <button className="profile-button" aria-label="Open profile"><span className="profile-avatar">{initials(displayName).slice(0, 1)}</span><span className="profile-name">{displayName}</span><ChevronDown size={13} /></button>
          <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation"><Menu size={20} /></button>
        </div>
      </header>

      <div className="studio-layout">
        <aside className={`studio-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
          <div className="workspace-select"><span className="workspace-icon">▤</span><span>Parth&apos;s Workspace</span><ChevronDown size={14} /></div>
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            {navItems.map(({ label, icon: Icon, section: itemSection }) => (
              <button key={label} className={`sidebar-link ${section === itemSection ? "is-active" : ""}`} onClick={() => { setSection(itemSection); setActiveFolder("All sites"); setMobileNavOpen(false); }}><Icon size={16} /><span>{label}</span></button>
            ))}
            <div className="sidebar-rule" />
            {secondaryItems.map(({ label, icon: Icon, section: itemSection, expandable }) => <button key={label} className={`sidebar-link ${(label === "Members" && section === "members") || (label === "Usage" && section === "usage") ? "is-active" : ""}`} onClick={() => { if (itemSection === "plans") navigate("/subscriptions"); else if (itemSection === "members") setSection("members"); else if (itemSection === "usage") setSection("usage"); setMobileNavOpen(false); }}><Icon size={16} /><span>{label}</span>{expandable && <ChevronRight className="sidebar-chevron" size={14} />}</button>)}
          </nav>
          <div className="sidebar-footer"><button className="sidebar-link"><CircleHelp size={16} /><span>Help center</span></button><button className="sidebar-link" onClick={handleLogout}><LogOut size={16} /><span>Log out</span></button></div>
        </aside>

        <main className="studio-main">
          {section === "members" ? <MembersView /> : section === "usage" ? <UsageView /> : <>
          <div className="main-heading-row">
            <div><p className="eyebrow">{section === "archive" ? "YOUR SITES, STORED" : "YOUR WEB, ORGANIZED"}</p><h1>{section === "archive" ? "Archive" : "All sites"}</h1><p className="subtitle">{section === "archive" ? "Restore and manage sites you have moved out of your workspace." : "Create, design, and manage your websites in one place."}</p></div>
            <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} /> New site</button>
          </div>

          <div className="toolbar">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sites..." /><kbd>/</kbd></label>
            <div className="sort-controls"><span>Sort by</span><button className="control-button" onClick={() => setSortNewestFirst((current) => !current)}>Last modified <ChevronDown size={13} /></button><button className="control-button" onClick={() => setSortNewestFirst((current) => !current)}>{sortNewestFirst ? "Descending" : "Ascending"}</button><div className="view-toggle"><button className={viewMode === "grid" ? "is-active" : ""} onClick={() => setViewMode("grid")} aria-label="Grid view"><Grid2X2 size={15} /></button><button className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")} aria-label="List view"><List size={16} /></button></div><button className="icon-button refresh-button" onClick={() => void fetchWebsites(true)} aria-label="Refresh sites"><RefreshCw size={15} className={refreshing ? "spin" : ""} /></button></div>
          </div>

          {section === "sites" && <div className="folders-section"><div className="section-label-row"><span className="section-label">Folders</span><button className="new-folder-button" onClick={addFolder}><FolderPlus size={14} /> New folder</button></div><div className="folder-tabs"><button className={`folder-tab ${activeFolder === "All sites" ? "is-active" : ""}`} onClick={() => setActiveFolder("All sites")}><Grid2X2 size={14} /> All sites <span className="count-badge">{websites.length}</span></button>{folders.map((folder) => <button key={folder} className={`folder-tab ${activeFolder === folder ? "is-active" : ""}`} onClick={() => setActiveFolder(folder)}><Folder size={14} /> {folder} <MoreHorizontal size={14} /></button>)}</div><p className="folder-helper">Drag owned sites into a folder, or choose “Move to folder” from a site&apos;s menu.</p></div>}

          <div className="sites-heading"><div className="sites-title"><h2>{section === "archive" ? "Archived sites" : activeFolder}</h2><span className="count-badge">{currentSites.length}</span></div><span className="save-note">Changes are saved to your workspace</span></div>

          {error && <div className="dashboard-error">{error}<button onClick={() => void fetchWebsites(true)}>Try again</button></div>}
          {loading && section === "sites" ? <div className="site-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div> : visibleWebsites.length === 0 ? <div className="empty-state"><div className="empty-icon"><Folder size={22} /></div><h3>{section === "archive" ? "Your archive is empty" : search ? "No sites found" : "Create your first site"}</h3><p>{search ? "Try a different search term." : "Start with a blank canvas, a template, or an AI-generated site."}</p>{section === "sites" && !search && <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} /> New site</button>}</div> : <div className={`site-grid ${viewMode === "list" ? "is-list" : ""}`}>{visibleWebsites.map((site, index) => <SiteCard key={site.id} site={site} index={index} viewMode={viewMode} menuId={menuId} onMenu={() => setMenuId(menuId === site.id ? null : site.id)} onOpen={() => navigate(`/editor/${site.id}`)} />)}</div>}
          </>}
        </main>
      </div>

          {createOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><form className="create-modal" onSubmit={handleCreate}><button type="button" className="modal-close" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={18} /></button><div className="modal-icon"><Sparkles size={20} /></div><p className="eyebrow">NEW PROJECT</p><h2>Create a new site</h2><p className="modal-description">Give your project a name. You can customize everything in the visual editor.</p><label className="modal-label" htmlFor="site-name">Site name<input id="site-name" autoFocus value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="e.g. Northstar Notes" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={creating || !siteName.trim()}>{creating ? "Creating..." : "Create site"}</button></div></form></div>}
    </div>
  );
}

function SiteCard({ site, index, viewMode, menuId, onMenu, onOpen }: { site: Website; index: number; viewMode: ViewMode; menuId: string | null; onMenu: () => void; onOpen: () => void }) {
  const color = ["#a83bf0", "#f05d93", "#3ac7b6"][index % 3];
  return <article className={`site-card ${viewMode === "list" ? "is-list" : ""}`}><button className="site-preview" onClick={onOpen} aria-label={`Open ${site.name}`}><div className="browser-bar"><span className="browser-dot red" /><span className="browser-dot yellow" /><span className="browser-dot green" /><span className="preview-url">{site.slug || site.name}</span></div><div className="preview-body" style={{ "--site-color": color } as React.CSSProperties}><div className="preview-initials">{initials(site.name)}</div><div className="preview-line wide" /><div className="preview-line" /><div className="preview-pill" /><div className="preview-blocks"><span /><span /><span /></div></div></button><div className="site-meta"><div><h3>{site.name}</h3><p>{relativeDate(site.updatedAt || site.createdAt)}</p></div><div className="site-card-actions"><button aria-label={`Favorite ${site.name}`}><Star size={15} /></button><div className="menu-wrap"><button onClick={onMenu} aria-label={`More options for ${site.name}`}><MoreHorizontal size={16} /></button>{menuId === site.id && <div className="site-menu"><button onClick={onOpen}>Open editor</button><button onClick={() => navigator.clipboard?.writeText(site.slug || site.name)}>Copy site slug</button></div>}</div></div></div></article>;
}

export default DashboardPage;
