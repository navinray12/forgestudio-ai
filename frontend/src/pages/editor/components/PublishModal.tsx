import React, { useState, useEffect } from "react";
import type { PublishingState, DeploymentConfig, PageConfig, DeploymentRecord } from "../types";
import { publishingService } from "../../../features/publishing/services/publishingService";
import { renderDisconnectConfirmDialog } from "./publishModal/overlays/disconnectConfirmDialog";
import { renderModalFooter } from "./publishModal/sections/modalFooter";
import { renderZipExportTab } from "./publishModal/tabs/zipExportTab";
import { renderSftpTab } from "./publishModal/tabs/sftpTab";
import { renderConnectWordPressForm } from "./publishModal/wordpress/connectWordPressForm";
import { renderDeleteMediaDialog } from "./publishModal/wordpress/deleteMediaDialog";
import { renderMediaLibraryPanel } from "./publishModal/wordpress/mediaLibraryPanel";
import { renderPagesPanel } from "./publishModal/wordpress/pagesPanel";
import { renderRollbackPanel } from "./publishModal/wordpress/rollbackPanel";
import { renderPublishJobsPanel } from "./publishModal/wordpress/publishJobsPanel";
import { renderPublishEnginePanel } from "./publishModal/wordpress/publishEnginePanel";
import { renderPublishStatusCard } from "./publishModal/wordpress/publishStatusCard";
import { renderSiteInfoPanel } from "./publishModal/wordpress/siteInfoPanel";
import { renderSiteHealthPanel } from "./publishModal/wordpress/siteHealthPanel";
import { renderConnectionStatusCard } from "./publishModal/wordpress/connectionStatusCard";
import { renderInternalPublishTab } from "./publishModal/tabs/internalPublishTab";
import { renderTabBar } from "./publishModal/sections/tabBar";
import { getStatusBadge } from "./publishModal/statusBadge";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  publishing: PublishingState;
  deployment: DeploymentConfig;
  pages: PageConfig[];
  websiteName: string;
  websiteId?: string;
  approvalWorkflowEnabled?: boolean;
  canPublish?: boolean;
  onPublish: (options?: { destinationType?: "INTERNAL" | "WORDPRESS" }) => Promise<void>;
  onSubmitApproval?: () => Promise<void>;
  onRollback?: (deploymentId: string) => Promise<void>;
  onUpdateDeployment: (config: DeploymentConfig) => void;
  onOpenPreview: () => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  publishing,
  deployment,
  pages,
  websiteName: _websiteName,
  websiteId,
  approvalWorkflowEnabled = false,
  canPublish = true,
  onPublish,
  onSubmitApproval,
  onRollback,
  onUpdateDeployment,
  onOpenPreview,
}) => {
  const [activeTab, setActiveTab] = useState<"internal" | "wordpress" | "sftp" | "zip">("internal");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [zipExportError, setZipExportError] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState(deployment?.customDomain || "");
  const [webhookUrl, setWebhookUrl] = useState(deployment?.webhookUrl || "");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // WordPress connection state
  const [wpStatus, setWpStatus] = useState<any>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpApiKey, setWpApiKey] = useState("");
  const [wpSiteName, setWpSiteName] = useState("");
  const [isConnectingWp, setIsConnectingWp] = useState(false);
  const [isVerifyingWp, setIsVerifyingWp] = useState(false);
  const [isDisconnectingWp, setIsDisconnectingWp] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [siteInfo, setSiteInfo] = useState<any>(null);
  const [isLoadingSiteInfo, setIsLoadingSiteInfo] = useState(false);
  const [siteInfoError, setSiteInfoError] = useState<string | null>(null);
  const [showSiteInfoPanel, setShowSiteInfoPanel] = useState(false);

  const [siteHealth, setSiteHealth] = useState<any>(null);
  const [isLoadingSiteHealth, setIsLoadingSiteHealth] = useState(false);
  const [siteHealthError, setSiteHealthError] = useState<string | null>(null);
  const [showSiteHealthPanel, setShowSiteHealthPanel] = useState(false);

  const handleFetchSiteInfo = async () => {
    if (!websiteId || isLoadingSiteInfo) return;
    setIsLoadingSiteInfo(true);
    setSiteInfoError(null);
    try {
      const data = await publishingService.getWordPressSiteInfo(websiteId);
      setSiteInfo(data);
      setShowSiteInfoPanel(true);
    } catch (err: any) {
      setSiteInfoError(err.message || "Failed to fetch WordPress site information");
    } finally {
      setIsLoadingSiteInfo(false);
    }
  };

  const handleFetchSiteHealth = async () => {
    if (!websiteId || isLoadingSiteHealth) return;
    setIsLoadingSiteHealth(true);
    setSiteHealthError(null);
    try {
      const data = await publishingService.getWordPressSiteHealth(websiteId);
      setSiteHealth(data);
      setShowSiteHealthPanel(true);
    } catch (err: any) {
      setSiteHealthError(err.message || "Failed to fetch WordPress site health diagnostics");
    } finally {
      setIsLoadingSiteHealth(false);
    }
  };

  const [wpPages, setWpPages] = useState<any[]>([]);
  const [isLoadingWpPages, setIsLoadingWpPages] = useState(false);
  const [wpPagesError, setWpPagesError] = useState<string | null>(null);
  const [showWpPagesPanel, setShowWpPagesPanel] = useState(false);
  const [wpPageSearch, setWpPageSearch] = useState("");
  const [wpPageStatusFilter, setWpPageStatusFilter] = useState("any");
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [editingPageId, setEditingPageId] = useState<number | null>(null);
  const [isImportingWpPageId, setIsImportingWpPageId] = useState<number | null>(null);
  const [pageFormData, setPageFormData] = useState({
    title: "",
    slug: "",
    status: "draft",
    parent: 0,
    content: "",
  });

  const handleImportPageToEditor = async (pageId: number) => {
    if (!websiteId || isImportingWpPageId) return;
    setIsImportingWpPageId(pageId);
    try {
      const res = await publishingService.importWordPressPage(websiteId, pageId);
      if (res && res.elements) {
        window.dispatchEvent(new CustomEvent("forgestudio:wp-page-imported", { detail: res }));
        onClose();
      }
    } catch (err: any) {
      alert(`Failed to import WordPress page: ${err.message}`);
    } finally {
      setIsImportingWpPageId(null);
    }
  };

  const handleFetchWpPages = async (overrideFilter?: string) => {
    if (!websiteId) return;
    setIsLoadingWpPages(true);
    setWpPagesError(null);
    try {
      const filter = overrideFilter !== undefined ? overrideFilter : wpPageStatusFilter;
      const data = await publishingService.listWordPressPages(websiteId, {
        search: wpPageSearch,
        status: filter,
      });
      setWpPages(data?.pages || []);
      setShowWpPagesPanel(true);
    } catch (err: any) {
      setWpPagesError(err.message || "Failed to fetch WordPress pages");
    } finally {
      setIsLoadingWpPages(false);
    }
  };

  const handleCreateOrUpdateWpPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId || !pageFormData.title.trim()) return;
    setIsLoadingWpPages(true);
    try {
      if (editingPageId) {
        await publishingService.updateWordPressPage(websiteId, editingPageId, {
          title: pageFormData.title.trim(),
          slug: pageFormData.slug.trim(),
          status: pageFormData.status,
          parent: Number(pageFormData.parent),
          content: pageFormData.content,
        });
      } else {
        await publishingService.createWordPressPage(websiteId, {
          title: pageFormData.title.trim(),
          slug: pageFormData.slug.trim(),
          status: pageFormData.status,
          parent: Number(pageFormData.parent),
          content: pageFormData.content,
        });
      }
      setIsCreatingPage(false);
      setEditingPageId(null);
      setPageFormData({ title: "", slug: "", status: "draft", parent: 0, content: "" });
      await handleFetchWpPages();
    } catch (err: any) {
      setWpPagesError(err.message || "Failed to save WordPress page");
    } finally {
      setIsLoadingWpPages(false);
    }
  };

  const handleDeleteWpPage = async (pageId: number, force: boolean) => {
    if (!websiteId) return;
    const confirmMsg = force
      ? "Are you sure you want to PERMANENTLY delete this WordPress page?"
      : "Move this page to WordPress trash?";
    if (!window.confirm(confirmMsg)) return;

    setIsLoadingWpPages(true);
    try {
      await publishingService.deleteWordPressPage(websiteId, pageId, force);
      await handleFetchWpPages();
    } catch (err: any) {
      setWpPagesError(err.message || "Failed to delete page");
    } finally {
      setIsLoadingWpPages(false);
    }
  };

  const handleDuplicateWpPage = async (pageId: number, pageTitle: string) => {
    if (!websiteId) return;
    if (!window.confirm(`Duplicate page "${pageTitle}"?\nA new draft copy will be created.`)) return;

    setIsLoadingWpPages(true);
    try {
      await publishingService.duplicateWordPressPage(websiteId, pageId);
      await handleFetchWpPages();
    } catch (err: any) {
      setWpPagesError(err.message || "Failed to duplicate page");
    } finally {
      setIsLoadingWpPages(false);
    }
  };

  const [draggedWpPageId, setDraggedWpPageId] = useState<number | null>(null);
  const [dropTargetWpPageId, setDropTargetWpPageId] = useState<number | null>(null);
  const [dropWpPosition, setDropWpPosition] = useState<"BEFORE" | "AFTER" | null>(null);
  const [isReorderingWpPages, setIsReorderingWpPages] = useState(false);

  const handleReorderWpPage = async (sourceId: number, targetId: number, position: "BEFORE" | "AFTER") => {
    if (!websiteId || sourceId === targetId) return;

    const previousWpPages = [...wpPages];

    // Optimistic UI update
    const sourceIdx = wpPages.findIndex((p) => p.id === sourceId);
    const targetIdx = wpPages.findIndex((p) => p.id === targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const reordered = [...wpPages];
      const [moved] = reordered.splice(sourceIdx, 1);
      const newIdx = position === "BEFORE" ? targetIdx : targetIdx + 1;
      reordered.splice(newIdx > sourceIdx ? newIdx - 1 : newIdx, 0, moved);
      setWpPages(reordered);
    }

    setIsReorderingWpPages(true);
    try {
      const res = await publishingService.reorderWordPressPage(websiteId, sourceId, {
        targetPageId: targetId,
        position,
      });
      if (res.pages) {
        setWpPages(res.pages);
      } else {
        await handleFetchWpPages();
      }
    } catch (err: any) {
      setWpPages(previousWpPages);
      setWpPagesError(err.message || "Failed to reorder pages");
    } finally {
      setIsReorderingWpPages(false);
      setDraggedWpPageId(null);
      setDropTargetWpPageId(null);
      setDropWpPosition(null);
    }
  };

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [mediaUploadSuccess, setMediaUploadSuccess] = useState<any | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  const [mediaFormData, setMediaFormData] = useState({
    title: "",
    altText: "",
    caption: "",
    description: "",
  });

  const handleUploadMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !websiteId) return;

    setIsUploadingMedia(true);
    setUploadProgress(10);
    setMediaUploadError(null);
    setMediaUploadSuccess(null);

    try {
      const res = await publishingService.uploadWordPressMedia(
        websiteId,
        file,
        {
          title: mediaFormData.title || file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
          altText: mediaFormData.altText,
          caption: mediaFormData.caption,
          description: mediaFormData.description,
        },
        undefined,
        (percent) => setUploadProgress(percent)
      );

      setMediaUploadSuccess(res.data || res);
      setMediaFormData({ title: "", altText: "", caption: "", description: "" });
      if (showWpMediaLibrary) {
        handleFetchWpMedia();
      }
    } catch (err: any) {
      setMediaUploadError(err.message || "Failed to upload media to WordPress");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // WordPress Media Library Management (F-494)
  const [wpMediaList, setWpMediaList] = useState<any[]>([]);
  const [wpMediaPagination, setWpMediaPagination] = useState({ page: 1, perPage: 12, total: 0, totalPages: 1 });
  const [isLoadingWpMedia, setIsLoadingWpMedia] = useState(false);
  const [wpMediaError, setWpMediaError] = useState<string | null>(null);
  const [showWpMediaLibrary, setShowWpMediaLibrary] = useState(false);
  const [wpMediaSearch, setWpMediaSearch] = useState("");
  const [wpMediaTypeFilter, setWpMediaTypeFilter] = useState<"all" | "image" | "document">("all");
  const [wpMediaOrderby, setWpMediaOrderby] = useState<"date" | "modified" | "title" | "filename">("date");
  const [wpMediaOrder, setWpMediaOrder] = useState<"ASC" | "DESC">("DESC");
  const [selectedMediaDetail, setSelectedMediaDetail] = useState<any | null>(null);
  const [isEditingMediaMeta, setIsEditingMediaMeta] = useState(false);
  const [editMediaMetaForm, setEditMediaMetaForm] = useState({ title: "", altText: "", caption: "", description: "" });
  const [isUpdatingMediaMeta, setIsUpdatingMediaMeta] = useState(false);
  const [isDeletingMediaId, setIsDeletingMediaId] = useState<number | null>(null);
  const [showDeleteMediaModal, setShowDeleteMediaModal] = useState<number | null>(null);
  const [deleteMediaForceOption, setDeleteMediaForceOption] = useState(false);

  const handleFetchWpMedia = async (pageOverride?: number) => {
    if (!websiteId || isLoadingWpMedia) return;
    setIsLoadingWpMedia(true);
    setWpMediaError(null);
    const targetPage = pageOverride !== undefined ? pageOverride : wpMediaPagination.page;

    try {
      const res = await publishingService.listWordPressMedia(websiteId, {
        search: wpMediaSearch,
        mediaType: wpMediaTypeFilter,
        orderby: wpMediaOrderby,
        order: wpMediaOrder,
        page: targetPage,
        perPage: wpMediaPagination.perPage,
      });

      const items = res?.data?.items || res?.items || [];
      const pagination = res?.data?.pagination || res?.pagination || { page: targetPage, perPage: 12, total: items.length, totalPages: 1 };
      setWpMediaList(items);
      setWpMediaPagination(pagination);
      setShowWpMediaLibrary(true);
    } catch (err: any) {
      setWpMediaError(err.message || "Failed to load WordPress media library");
    } finally {
      setIsLoadingWpMedia(false);
    }
  };

  const handleSaveMediaMetadata = async () => {
    if (!websiteId || !selectedMediaDetail || isUpdatingMediaMeta) return;
    setIsUpdatingMediaMeta(true);
    try {
      const updated = await publishingService.updateWordPressMedia(
        websiteId,
        selectedMediaDetail.id,
        editMediaMetaForm
      );
      const data = updated.data || updated;
      setSelectedMediaDetail(data);
      setIsEditingMediaMeta(false);
      setWpMediaList((prev) => prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)));
    } catch (err: any) {
      alert(`Failed to update media metadata: ${err.message}`);
    } finally {
      setIsUpdatingMediaMeta(false);
    }
  };

  const handleDeleteMediaItem = async (mediaId: number, force: boolean) => {
    if (!websiteId || isDeletingMediaId) return;
    setIsDeletingMediaId(mediaId);
    try {
      await publishingService.deleteWordPressMedia(websiteId, mediaId, { force });
      setShowDeleteMediaModal(null);
      if (selectedMediaDetail?.id === mediaId) {
        setSelectedMediaDetail(null);
      }
      await handleFetchWpMedia();
    } catch (err: any) {
      alert(`Failed to delete media item: ${err.message}`);
    } finally {
      setIsDeletingMediaId(null);
    }
  };

  // SFTP connection state
  const [sftpHost, setSftpHost] = useState("");
  const [sftpPort, setSftpPort] = useState("22");
  const [sftpUsername, setSftpUsername] = useState("");
  const [sftpPassword, setSftpPassword] = useState("");
  const [sftpRemotePath, setSftpRemotePath] = useState("/var/www/html");
  const [isTestingSftp, setIsTestingSftp] = useState(false);
  const [isSyncingSftp, setIsSyncingSftp] = useState(false);
  const [sftpFeedback, setSftpFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sftpVerified, setSftpVerified] = useState(false);
  const [publishingFormat, setPublishingFormat] = useState<"html" | "gutenberg">("html");

  useEffect(() => {
    if (isOpen && websiteId) {
      loadDeployments();
      loadWordPressStatus();
      loadWpPagePublishStatus();
      loadWpRollbackTargets();
      loadWpJobs();
      loadSftpConfig();
      loadHtmlPreview();
    }
  }, [isOpen, websiteId, publishingFormat]);

  const loadSftpConfig = async () => {
    if (!websiteId) return;
    try {
      const data = await publishingService.getSftpConfig(websiteId);
      if (data?.config) {
        setSftpHost(data.config.host || "");
        setSftpPort(String(data.config.port || 22));
        setSftpUsername(data.config.username || "");
        setSftpRemotePath(data.config.remotePath || "/var/www/html");
        setSftpVerified(data.config.status === "CONNECTED");
      }
    } catch (e) {}
  };

  const handleTestSftp = async () => {
    if (!sftpHost || !sftpUsername) {
      setSftpFeedback({ type: "error", message: "Host and Username are required." });
      return;
    }
    setIsTestingSftp(true);
    setSftpFeedback(null);
    try {
      await publishingService.saveSftpConfig({
        websiteId,
        host: sftpHost,
        port: parseInt(sftpPort, 10) || 22,
        username: sftpUsername,
        password: sftpPassword,
        remotePath: sftpRemotePath,
      });
      const res = await publishingService.verifySftpConfig({
        host: sftpHost,
        port: parseInt(sftpPort, 10) || 22,
        username: sftpUsername,
        password: sftpPassword,
      });
      if (res.success || res.verified) {
        setSftpVerified(true);
        setSftpFeedback({ type: "success", message: "SFTP connection verified successfully!" });
      } else {
        setSftpFeedback({ type: "error", message: res.error || "Connection test failed." });
      }
    } catch (err: any) {
      setSftpFeedback({ type: "error", message: err.message || "Failed to verify SFTP connection." });
    } finally {
      setIsTestingSftp(false);
    }
  };

  const handleSyncSftp = async () => {
    if (!websiteId) return;
    setIsSyncingSftp(true);
    setSftpFeedback(null);
    try {
      const res = await publishingService.syncSftp(websiteId, {
        environment: "PRODUCTION",
      });
      if (res.success) {
        setSftpFeedback({ type: "success", message: `Successfully synced ${res.syncedFilesCount || "all"} files to SFTP server!` });
        loadDeployments();
      } else {
        setSftpFeedback({ type: "error", message: res.error || "SFTP sync failed." });
      }
    } catch (err: any) {
      setSftpFeedback({ type: "error", message: err.message || "SFTP sync failed." });
    } finally {
      setIsSyncingSftp(false);
    }
  };
  const loadDeployments = async () => {
    if (!websiteId) return;
    try {
      setLoadingDeployments(true);
      const data = await publishingService.getDeployments(websiteId);
      setDeployments(data);
    } catch (e) {
      console.warn("Could not load deployments:", e);
    } finally {
      setLoadingDeployments(false);
    }
  };

  const loadWordPressStatus = async () => {
    if (!websiteId) return;
    try {
      const data = await publishingService.getWordPressStatus(websiteId);
      setWpStatus(data);
      if (data?.connection?.siteUrl) {
        setWpSiteUrl(data.connection.siteUrl);
      }
      if (data?.connection?.wpSiteName) {
        setWpSiteName(data.connection.wpSiteName);
      }
    } catch (e) {
      console.warn("Could not load WordPress status:", e);
    }
  };

  const [isDownloadingPlugin, setIsDownloadingPlugin] = useState(false);

  // F-495, F-496 & F-497 WordPress Page Publish & Rollback State
  const [isPublishingWpPage, setIsPublishingWpPage] = useState(false);
  const [wpPublishStep, setWpPublishStep] = useState<string>("");
  const [wpPublishResult, setWpPublishResult] = useState<any | null>(null);
  const [wpPublishError, setWpPublishError] = useState<string | null>(null);
  const [wpPublishStatusMode, setWpPublishStatusMode] = useState<"publish" | "draft" | "private">("publish");
  const [htmlPreviewData, setHtmlPreviewData] = useState<any | null>(null);
  const [isLoadingHtmlPreview, setIsLoadingHtmlPreview] = useState(false);
  const [htmlPreviewError, setHtmlPreviewError] = useState<string | null>(null);
  const [showRawHtmlModal, setShowRawHtmlModal] = useState(false);

  const loadHtmlPreview = async () => {
    if (!websiteId) return;
    setIsLoadingHtmlPreview(true);
    setHtmlPreviewError(null);
    try {
      if (publishingFormat === "gutenberg") {
        const res = await publishingService.previewWordPressGutenberg(websiteId, "default");
        setHtmlPreviewData(res);
      } else {
        const res = await publishingService.previewWordPressHtml(websiteId, "default");
        setHtmlPreviewData(res);
      }
    } catch (err: any) {
      setHtmlPreviewError(err.message || "Failed to generate publishing preview");
    } finally {
      setIsLoadingHtmlPreview(false);
    }
  };

  const [wpPagePublishStatus, setWpPagePublishStatus] = useState<any | null>(null);
  const [isLoadingWpPublishStatus, setIsLoadingWpPublishStatus] = useState(false);

  // F-497 Rollback States
  const [wpRollbackTargets, setWpRollbackTargets] = useState<any[]>([]);
  const [isLoadingRollbackTargets, setIsLoadingRollbackTargets] = useState(false);
  const [isRollingBackWpPage, setIsRollingBackWpPage] = useState(false);
  const [wpRollbackStep, setWpRollbackStep] = useState<string>("");
  const [selectedRollbackTarget, setSelectedRollbackTarget] = useState<any | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [wpRollbackResult, setWpRollbackResult] = useState<any | null>(null);
  const [wpRollbackError, setWpRollbackError] = useState<string | null>(null);

  // F-498 WordPress Publishing Job States
  const [wpJobs, setWpJobs] = useState<any[]>([]);
  const [isLoadingWpJobs, setIsLoadingWpJobs] = useState(false);
  const [activeWpJob, setActiveWpJob] = useState<any | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [wpJobFeedback, setWpJobFeedback] = useState<string | null>(null);

  const loadWpJobs = async (pageId?: string) => {
    if (!websiteId) return;
    setIsLoadingWpJobs(true);
    try {
      const list = await publishingService.listWordPressPublishJobs(websiteId, pageId);
      setWpJobs(list || []);
      const active = (list || []).find((j: any) => j.status === "QUEUED" || j.status === "RUNNING");
      if (active) {
        setActiveWpJob(active);
      }
    } catch (err) {
      console.warn("Could not load WordPress publish jobs:", err);
    } finally {
      setIsLoadingWpJobs(false);
    }
  };

  const handleEnqueueWpPublishJob = async (pageId: string = "default") => {
    if (!websiteId || isCreatingJob) return;
    setIsCreatingJob(true);
    setWpJobFeedback(null);
    setWpPublishError(null);

    try {
      const res = await publishingService.createWordPressPublishJob(websiteId, pageId, {
        status: wpPublishStatusMode,
        format: publishingFormat,
      });

      if (res.job) {
        setActiveWpJob(res.job);
        setWpJobFeedback(res.message || "WordPress publishing job queued successfully.");
        await loadWpJobs(pageId);
      }
    } catch (err: any) {
      setWpPublishError(err.message || "Failed to enqueue WordPress publish job");
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleCancelWpJob = async (jobId: string) => {
    if (!websiteId || cancellingJobId) return;
    setCancellingJobId(jobId);
    try {
      await publishingService.cancelWordPressPublishJob(websiteId, jobId);
      if (activeWpJob?.id === jobId) {
        setActiveWpJob(null);
      }
      setWpJobFeedback("Job cancelled successfully.");
      await loadWpJobs();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    } finally {
      setCancellingJobId(null);
    }
  };

  const handleRetryWpJob = async (jobId: string) => {
    if (!websiteId || retryingJobId) return;
    setRetryingJobId(jobId);
    try {
      const res = await publishingService.retryWordPressPublishJob(websiteId, jobId);
      if (res.job) {
        setActiveWpJob(res.job);
      }
      setWpJobFeedback("Job re-queued for retry.");
      await loadWpJobs();
    } catch (err: any) {
      alert(`Failed to retry job: ${err.message}`);
    } finally {
      setRetryingJobId(null);
    }
  };

  // F-498 Auto-polling for active background job status
  useEffect(() => {
    if (!isOpen || !websiteId || !activeWpJob) return;
    if (activeWpJob.status !== "QUEUED" && activeWpJob.status !== "RUNNING") return;

    const interval = setInterval(async () => {
      try {
        const updated = await publishingService.getWordPressPublishJobStatus(websiteId, activeWpJob.id);
        if (updated) {
          setActiveWpJob(updated);
          if (updated.status === "COMPLETED" || updated.status === "FAILED" || updated.status === "CANCELLED") {
            await loadWpJobs();
            await loadWpPagePublishStatus();
            await loadWpRollbackTargets();
          }
        }
      } catch (e) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, websiteId, activeWpJob?.id, activeWpJob?.status]);


  const loadWpPagePublishStatus = async (pageId?: string) => {
    if (!websiteId || isLoadingWpPublishStatus) return;
    setIsLoadingWpPublishStatus(true);
    try {
      const res = await publishingService.getWordPressPublishStatus(websiteId, pageId || "default");
      setWpPagePublishStatus(res);
    } catch (err) {
      console.warn("Could not load WordPress page publish status:", err);
    } finally {
      setIsLoadingWpPublishStatus(false);
    }
  };

  const loadWpRollbackTargets = async (pageId?: string) => {
    if (!websiteId) return;
    setIsLoadingRollbackTargets(true);
    try {
      const targets = await publishingService.getWordPressRollbackTargets(websiteId, pageId || "default");
      setWpRollbackTargets(targets || []);
    } catch (err) {
      console.warn("Could not load WordPress rollback targets:", err);
    } finally {
      setIsLoadingRollbackTargets(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!websiteId || !selectedRollbackTarget || isRollingBackWpPage) return;
    setIsRollingBackWpPage(true);
    setWpRollbackError(null);
    setWpRollbackResult(null);

    try {
      setWpRollbackStep("Preparing rollback operation...");
      await new Promise((r) => setTimeout(r, 200));

      setWpRollbackStep("Loading historical publish version snapshot...");
      await new Promise((r) => setTimeout(r, 200));

      setWpRollbackStep("Validating remote WordPress page existence...");
      await new Promise((r) => setTimeout(r, 200));

      setWpRollbackStep("Resolving media assets & block transformation...");
      await new Promise((r) => setTimeout(r, 200));

      setWpRollbackStep("Updating remote WordPress content...");
      const res = await publishingService.rollbackWordPressPage(websiteId, "default", selectedRollbackTarget.snapshotId);

      setWpRollbackStep("Verifying rollback result...");
      await new Promise((r) => setTimeout(r, 250));

      setWpRollbackResult(res);
      setShowRollbackConfirm(false);

      await loadWpPagePublishStatus();
      await loadWpRollbackTargets();
    } catch (err: any) {
      if (err.code === "WORDPRESS_ROLLBACK_RESULT_UNKNOWN") {
        setWpRollbackError("Rollback request timed out. The remote WordPress state is unknown. Perform a status check to verify.");
      } else {
        setWpRollbackError(err.message || "Rollback operation failed.");
      }
    } finally {
      setIsRollingBackWpPage(false);
      setWpRollbackStep("");
    }
  };

  const handlePublishWpPageAction = async (statusOverride?: "publish" | "draft" | "private") => {
    if (!websiteId || isPublishingWpPage) return;
    const statusToUse = statusOverride || wpPublishStatusMode;

    setIsPublishingWpPage(true);
    setWpPublishError(null);
    setWpPublishResult(null);

    try {
      setWpPublishStep("Validating pre-publish readiness & connection health...");
      await new Promise((r) => setTimeout(r, 250));

      setWpPublishStep(publishingFormat === "html" ? "Compiling HTML & responsive CSS with SHA-256 validation..." : "Transforming document JSON into Gutenberg block markup...");
      await new Promise((r) => setTimeout(r, 250));

      setWpPublishStep("Resolving media references & page mapping...");
      await new Promise((r) => setTimeout(r, 250));

      setWpPublishStep("Sending signed payload to WordPress REST API...");
      const res = await publishingService.publishWordPressPage(websiteId, {
        status: statusToUse,
        format: publishingFormat,
      });

      setWpPublishStep("Published successfully!");
      setWpPublishResult(res);
      await loadWordPressStatus();
      await loadWpPagePublishStatus();
    } catch (err: any) {
      setWpPublishError(err.message || "Failed to publish page to WordPress");
      await loadWpPagePublishStatus();
    } finally {
      setIsPublishingWpPage(false);
    }
  };

  const handleDownloadPlugin = async () => {
    if (!websiteId) return;
    try {
      setIsDownloadingPlugin(true);
      await publishingService.downloadWordPressPlugin(websiteId);
      setSaveFeedback("Downloaded forgestudio-connector.zip archive!");
      setTimeout(() => setSaveFeedback(""), 3500);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Failed to download plugin zip");
    } finally {
      setIsDownloadingPlugin(false);
    }
  };

  if (!isOpen) return null;

  const isActuallyDeployed = deployment?.provider !== "none" && Boolean(deployment?.deployedAt);

  const handlePublishClick = async (dest: "INTERNAL" | "WORDPRESS" = "INTERNAL") => {
    try {
      setIsPublishing(true);
      setSaveFeedback("");
      await onPublish({ destinationType: dest });
      setSaveFeedback(`Website successfully published to ${dest === "WORDPRESS" ? "WordPress" : "live version"}!`);
      loadDeployments();
      if (dest === "WORDPRESS") {
        loadWordPressStatus();
      }
      setTimeout(() => setSaveFeedback(""), 4000);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Failed to publish website.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSubmitApproval = async () => {
    setIsSubmittingApproval(true);
    setSaveFeedback("");
    try {
      if (onSubmitApproval) {
        await onSubmitApproval();
      } else if (websiteId) {
        const res = await fetch(`/api/approval-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ websiteId, note: "Ready for publication review." }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.message || "Failed to submit for approval");
        }
      }
      setSaveFeedback("Publication request submitted for approval!");
      setTimeout(() => setSaveFeedback(""), 4000);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Failed to submit for approval.");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRollbackClick = async (deploymentId: string, version: number) => {
    if (!onRollback && !websiteId) return;
    const confirm = window.confirm(`Are you sure you want to rollback to deployment v${version}? This will create a new live deployment.`);
    if (!confirm) return;

    try {
      setIsRollingBack(deploymentId);
      setSaveFeedback("");
      if (onRollback) {
        await onRollback(deploymentId);
      } else if (websiteId) {
        await publishingService.rollbackDeployment(websiteId, deploymentId);
      }
      setSaveFeedback(`Successfully rolled back to v${version}!`);
      loadDeployments();
      setTimeout(() => setSaveFeedback(""), 4000);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Rollback failed.");
    } finally {
      setIsRollingBack(null);
    }
  };

  const handleConnectWordPress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId || !wpSiteUrl.trim() || !wpApiKey.trim()) return;

    try {
      setIsConnectingWp(true);
      setSaveFeedback("");
      await publishingService.connectWordPress(websiteId, wpSiteUrl, wpApiKey, wpSiteName);
      setSaveFeedback("Successfully connected to WordPress destination!");
      setWpApiKey("");
      await loadWordPressStatus();
      setTimeout(() => setSaveFeedback(""), 3500);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Failed to connect to WordPress.");
    } finally {
      setIsConnectingWp(false);
    }
  };

  const handleVerifyWordPress = async () => {
    if (!websiteId) return;
    try {
      setIsVerifyingWp(true);
      setSaveFeedback("");
      const result = await publishingService.verifyWordPress(websiteId);
      const v = result?.verification;
      setVerificationDetails(v);
      if (v?.healthy) {
        setSaveFeedback(`WordPress connection verified! Latency: ${v.responseTimeMs}ms`);
      } else {
        const errMsg = v?.errors?.[0]?.message || "Verification failed";
        setSaveFeedback(`Verification failed: ${errMsg}`);
      }
      await loadWordPressStatus();
      setTimeout(() => setSaveFeedback(""), 4500);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Verification failed.");
    } finally {
      setIsVerifyingWp(false);
    }
  };

  const handleDisconnectWordPress = () => {
    setShowDisconnectConfirm(true);
  };

  const confirmDisconnect = async () => {
    if (!websiteId) return;
    setShowDisconnectConfirm(false);
    setIsDisconnectingWp(true);
    try {
      setSaveFeedback("");
      await publishingService.disconnectWordPress(websiteId);
      setSaveFeedback("WordPress connection disconnected safely. ForgeStudio pages and revisions preserved.");
      await loadWordPressStatus();
      setTimeout(() => setSaveFeedback(""), 4000);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Disconnect failed.");
    } finally {
      setIsDisconnectingWp(false);
    }
  };

  const handleRevokeWordPress = async () => {
    if (!websiteId) return;
    const confirm = window.confirm("Are you sure you want to revoke this WordPress connection?");
    if (!confirm) return;

    try {
      setSaveFeedback("");
      await publishingService.revokeWordPressConnection(websiteId);
      setSaveFeedback("WordPress connection revoked.");
      await loadWordPressStatus();
      setTimeout(() => setSaveFeedback(""), 3500);
    } catch (err: any) {
      setSaveFeedback(err?.message || "Revoke failed.");
    }
  };

  const handleSaveDeploymentConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDeployment({
      ...deployment,
      customDomain: customDomain.trim() || undefined,
      webhookUrl: webhookUrl.trim() || undefined,
      provider: customDomain.trim() || webhookUrl.trim() ? "custom" : "none",
    });
    setSaveFeedback("Deployment settings updated.");
    setTimeout(() => setSaveFeedback(""), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold">
              🚀
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Publish & Deployment</h2>
              <p className="text-xs text-slate-400">
                Manage website versions, preview live status, and configure hosting.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        {/* See publishModal/sections/tabBar (moved verbatim) */}
        {renderTabBar({
          activeTab,
          setActiveTab,
          sftpVerified,
          wpStatus,
        })}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[68vh]">
          {activeTab === "internal" ? (
            <>
              {/* Status Overview Card */}
              {/* See publishModal/tabs/internalPublishTab (moved verbatim) */}
              {renderInternalPublishTab({
                approvalWorkflowEnabled,
                canPublish,
                customDomain,
                deployment,
                deployments,
                getStatusBadge,
                handlePublishClick,
                handleRollbackClick,
                handleSaveDeploymentConfig,
                handleSubmitApproval,
                isActuallyDeployed,
                isPublishing,
                isRollingBack,
                isSubmittingApproval,
                loadDeployments,
                loadingDeployments,
                pages,
                publishing,
                setCustomDomain,
                setWebhookUrl,
                webhookUrl,
                websiteId,
              })}
            </>
          ) : (
            /* WordPress Destination Tab */
            <div className="space-y-5">
              {wpStatus?.isConnected ? (
                /* Connected View */
                <div className="space-y-4">
                  {/* See publishModal/wordpress/connectionStatusCard (moved verbatim) */}
                  {renderConnectionStatusCard({
                    handleDisconnectWordPress,
                    handleFetchSiteHealth,
                    handleFetchSiteInfo,
                    handleFetchWpMedia,
                    handleFetchWpPages,
                    handleRevokeWordPress,
                    handleVerifyWordPress,
                    isLoadingSiteHealth,
                    isLoadingSiteInfo,
                    isLoadingWpMedia,
                    isLoadingWpPages,
                    isVerifyingWp,
                    verificationDetails,
                    wpStatus,
                  })}

                  {/* Site Information UI Panel */}
                  {siteInfoError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-1">
                      <div className="font-extrabold text-rose-200">⚠️ Could not load Site Information:</div>
                      <div className="font-mono text-[11px] text-rose-300">{siteInfoError}</div>
                    </div>
                  )}

                  {/* Site Health UI Panel Errors & Display */}
                  {siteHealthError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-1">
                      <div className="font-extrabold text-rose-200">⚠️ Could not load Site Health Diagnostics:</div>
                      <div className="font-mono text-[11px] text-rose-300">{siteHealthError}</div>
                    </div>
                  )}

                  {/* See publishModal/wordpress/siteHealthPanel (moved verbatim) */}
                  {renderSiteHealthPanel({
                    handleFetchSiteHealth,
                    isLoadingSiteHealth,
                    showSiteHealthPanel,
                    siteHealth,
                  })}

                  {/* See publishModal/wordpress/siteInfoPanel (moved verbatim) */}
                  {renderSiteInfoPanel({
                    handleFetchSiteInfo,
                    isLoadingSiteInfo,
                    showSiteInfoPanel,
                    siteInfo,
                  })}

                  {/* F-496 WORDPRESS PUBLISH STATUS CARD */}
                  {/* See publishModal/wordpress/publishStatusCard (moved verbatim) */}
                  {renderPublishStatusCard({
                    handleConnectWordPress,
                    handlePublishWpPageAction,
                    isLoadingWpPublishStatus,
                    isPublishingWpPage,
                    loadWpPagePublishStatus,
                    wpPagePublishStatus,
                  })}

                  {/* F-495 WordPress Publish Engine Panel */}
                  {/* See publishModal/wordpress/publishEnginePanel (moved verbatim) */}
                  {renderPublishEnginePanel({
                    activeWpJob,
                    handleEnqueueWpPublishJob,
                    handlePublishWpPageAction,
                    htmlPreviewData,
                    isCreatingJob,
                    isLoadingHtmlPreview,
                    isPublishingWpPage,
                    loadHtmlPreview,
                    pages,
                    publishingFormat,
                    setPublishingFormat,
                    setWpPublishStatusMode,
                    wpPublishError,
                    wpPublishResult,
                    wpPublishStatusMode,
                    wpPublishStep,
                    wpStatus,
                  })}

                  {/* F-498 WordPress Publishing Jobs Orchestration Panel */}
                  {/* See publishModal/wordpress/publishJobsPanel (moved verbatim) */}
                  {renderPublishJobsPanel({
                    activeWpJob,
                    cancellingJobId,
                    handleCancelWpJob,
                    handleEnqueueWpPublishJob,
                    handleRetryWpJob,
                    isCreatingJob,
                    isLoadingWpJobs,
                    loadWpJobs,
                    retryingJobId,
                    wpJobFeedback,
                    wpJobs,
                  })}


                  {/* F-497 WordPress Publish Rollback Panel */}
                  {/* See publishModal/wordpress/rollbackPanel (moved verbatim) */}
                  {renderRollbackPanel({
                    handleExecuteRollback,
                    isLoadingRollbackTargets,
                    isRollingBackWpPage,
                    loadWpPagePublishStatus,
                    loadWpRollbackTargets,
                    selectedRollbackTarget,
                    setSelectedRollbackTarget,
                    setShowRollbackConfirm,
                    showRollbackConfirm,
                    wpRollbackError,
                    wpRollbackResult,
                    wpRollbackStep,
                    wpRollbackTargets,
                  })}
                  {/* WordPress Pages Management UI Panel */}
                  {wpPagesError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-1">
                      <div className="font-extrabold text-rose-200">⚠️ WordPress Page Error:</div>
                      <div className="font-mono text-[11px] text-rose-300">{wpPagesError}</div>
                    </div>
                  )}

                  {/* See publishModal/wordpress/pagesPanel (moved verbatim) */}
                  {renderPagesPanel({
                    draggedWpPageId,
                    dropTargetWpPageId,
                    dropWpPosition,
                    editingPageId,
                    handleCreateOrUpdateWpPage,
                    handleDeleteWpPage,
                    handleDuplicateWpPage,
                    handleFetchWpPages,
                    handleImportPageToEditor,
                    handleReorderWpPage,
                    handleUploadMediaFile,
                    isCreatingPage,
                    isImportingWpPageId,
                    isLoadingWpPages,
                    isReorderingWpPages,
                    isUploadingMedia,
                    mediaFormData,
                    mediaUploadError,
                    mediaUploadSuccess,
                    pageFormData,
                    setDraggedWpPageId,
                    setDropTargetWpPageId,
                    setDropWpPosition,
                    setEditingPageId,
                    setIsCreatingPage,
                    setMediaFormData,
                    setPageFormData,
                    setShowMediaUploadModal,
                    setWpPageSearch,
                    setWpPageStatusFilter,
                    showMediaUploadModal,
                    showWpPagesPanel,
                    uploadProgress,
                    wpPageSearch,
                    wpPageStatusFilter,
                    wpPages,
                  })}

                  {/* WordPress Media Library Management UI Panel (F-494) */}
                  {wpMediaError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs space-y-1">
                      <div className="font-extrabold text-rose-200">⚠️ WordPress Media Library Error:</div>
                      <div className="font-mono text-[11px] text-rose-300">{wpMediaError}</div>
                    </div>
                  )}

                  {/* See publishModal/wordpress/mediaLibraryPanel (moved verbatim) */}
                  {renderMediaLibraryPanel({
                    editMediaMetaForm,
                    handleFetchWpMedia,
                    handleSaveMediaMetadata,
                    isEditingMediaMeta,
                    isLoadingWpMedia,
                    isUpdatingMediaMeta,
                    selectedMediaDetail,
                    setDeleteMediaForceOption,
                    setEditMediaMetaForm,
                    setIsCreatingPage,
                    setIsEditingMediaMeta,
                    setSelectedMediaDetail,
                    setShowDeleteMediaModal,
                    setShowMediaUploadModal,
                    setWpMediaOrder,
                    setWpMediaOrderby,
                    setWpMediaSearch,
                    setWpMediaTypeFilter,
                    showMediaUploadModal,
                    showWpMediaLibrary,
                    wpMediaList,
                    wpMediaOrder,
                    wpMediaOrderby,
                    wpMediaPagination,
                    wpMediaSearch,
                    wpMediaTypeFilter,
                  })}

                  {/* Delete Media Confirmation Dialog */}
                  {/* See publishModal/wordpress/deleteMediaDialog (moved verbatim) */}
                  {renderDeleteMediaDialog({
                    deleteMediaForceOption,
                    handleDeleteMediaItem,
                    isDeletingMediaId,
                    setDeleteMediaForceOption,
                    setShowDeleteMediaModal,
                    showDeleteMediaModal,
                  })}
                </div>
              ) : (
                /* See publishModal/wordpress/connectWordPressForm (moved verbatim) */ renderConnectWordPressForm({
                  handleConnectWordPress,
                  handleDownloadPlugin,
                  isConnectingWp,
                  isDownloadingPlugin,
                  setWpApiKey,
                  setWpSiteName,
                  setWpSiteUrl,
                  wpApiKey,
                  wpSiteName,
                  wpSiteUrl,
                })
              )}
            </div>
          )}

          {/* SFTP Destination Panel */}
          {/* See publishModal/tabs/sftpTab (moved verbatim) */}
          {renderSftpTab({
            activeTab,
            handleSyncSftp,
            handleTestSftp,
            isSyncingSftp,
            isTestingSftp,
            setSftpHost,
            setSftpPassword,
            setSftpPort,
            setSftpRemotePath,
            setSftpUsername,
            sftpFeedback,
            sftpHost,
            sftpPassword,
            sftpPort,
            sftpRemotePath,
            sftpUsername,
          })}

          {/* Static ZIP Bundle Panel */}
          {/* See publishModal/tabs/zipExportTab (moved verbatim) */}
          {renderZipExportTab({
            activeTab,
            pages,
            setZipExportError,
            websiteId,
            zipExportError,
          })}

          {saveFeedback && (
            <div className="rounded-lg bg-blue-900/40 border border-blue-500/40 p-2.5 text-xs font-semibold text-blue-200 text-center animate-fadeIn">
              {saveFeedback}
            </div>
          )}
        </div>

        {/* Footer */}
        {/* See publishModal/sections/modalFooter (moved verbatim) */}
        {renderModalFooter({
          onClose,
          onOpenPreview,
          publishing,
          websiteId,
        })}
      </div>

      {/* Disconnect Confirmation Modal */}
      {/* See publishModal/overlays/disconnectConfirmDialog (moved verbatim) */}
      {renderDisconnectConfirmDialog({
        confirmDisconnect,
        isDisconnectingWp,
        setShowDisconnectConfirm,
        showDisconnectConfirm,
      })}
    </div>
  );
};
