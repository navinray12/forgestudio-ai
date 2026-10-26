import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  RotateCw,
  Eye,
  EyeOff,
  Send,
  Plus,
  Layers,
  ChevronDown,
  ChevronRight,
  Mic,
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  FileText,
  Blocks,
  Layout,
  Shapes,
  Puzzle,
  Settings as SettingsIcon,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Truck,
  RotateCcw as ReturnIcon,
  Leaf,
  Play,
  Search,
  User,
  ShoppingBag,
  Paperclip,
  CheckSquare,
  Square,
  X,
  Loader2,
  Bell,
  Home,
  Box,
  Mail,
  Info,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Download,
  Upload,
  Globe,
  Palette,
  Contrast,
  Moon,
  Sun,
  MousePointer,
  Link2,
  Maximize2,
  Sliders,
  Type,
  Image as ImageIcon,
} from "lucide-react";
import { HeaderUserDropdown } from "../../components/HeaderUserDropdown";
import { useAuth } from "../../context/AuthContext";
import "./AiBuilder.css";

type AiStep = "prompt" | "describe" | "select-pages" | "builder";
type ViewMode = "code" | "preview";
type DeviceMode = "desktop" | "tablet" | "mobile";

export default function AiBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDirectBuilder =
    location.pathname === "/builder" ||
    location.pathname === "/editor" ||
    location.pathname.includes("summer-sale") ||
    searchParams.get("step") === "editor" ||
    searchParams.get("view") === "editor" ||
    searchParams.get("step") === "builder";

  // Workflow steps: "prompt" (Screen 1) -> "describe" (Screen 2) -> "select-pages" (Screen 3 preview / Screen 4 code) -> "builder" (Advanced 3-panel dashboard)
  const [currentStep, setCurrentStep] = useState<AiStep>(isDirectBuilder ? "builder" : "prompt");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [zoomLevel, setZoomLevel] = useState("100%");
  const [isPreviewModeOnly, setIsPreviewModeOnly] = useState(false);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam === "1" || stepParam === "prompt") {
      setCurrentStep("prompt");
    } else if (stepParam === "2" || stepParam === "describe") {
      setCurrentStep("describe");
    } else if (stepParam === "3" || stepParam === "preview") {
      setCurrentStep("select-pages");
      setViewMode("preview");
    } else if (stepParam === "4" || stepParam === "code") {
      setCurrentStep("select-pages");
      setViewMode("code");
    } else if (stepParam === "editor" || stepParam === "builder" || isDirectBuilder) {
      setCurrentStep("builder");
    }
  }, [location.search, location.pathname]);

  // Advanced Dashboard State
  const [leftSidebarTab, setLeftSidebarTab] = useState<"pages" | "blocks" | "assets">("pages");
  const [inspectorTab, setInspectorTab] = useState<"style" | "animation" | "advanced">("advanced");
  const [tokenCategory, setTokenCategory] = useState<"colors" | "typography" | "spacing" | "shadows" | "custom">("colors");
  const [tokenTheme, setTokenTheme] = useState("Theme: Dark");

  // Pages state
  const [builderPages, setBuilderPages] = useState<Array<{ id: string; name: string; icon: string }>>([
    { id: "home", name: "Home", icon: "home" },
    { id: "products", name: "Products", icon: "box" },
    { id: "collections", name: "Collections", icon: "layers" },
    { id: "about", name: "About", icon: "info" },
    { id: "contact", name: "Contact", icon: "mail" },
  ]);
  const [activeBuilderPage, setActiveBuilderPage] = useState("home");

  // Layers Tree State
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [isHeroGroupOpen, setIsHeroGroupOpen] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState("headline");
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);

  // Canvas Content State (In-place editable!)
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [announcementText, setAnnouncementText] = useState("Get 15% off everything this summer");
  const [promoCode, setPromoCode] = useState("USE CODE: SUMMER15");
  const [heroEyebrow, setHeroEyebrow] = useState("Summer Collection");
  const [heroHeadline, setHeroHeadline] = useState("Gear up for bigger adventures.");
  const [heroDesc, setHeroDesc] = useState("Premium outdoor gear, delivered to your door. Rent or buy. Explore more.");
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);

  // Search adventure booking form state
  const [gearType, setGearType] = useState("Snowboard");
  const [deliveryDate, setDeliveryDate] = useState("2024-03-10");
  const [returnDate, setReturnDate] = useState("2024-03-15");
  const [searchLocation, setSearchLocation] = useState("Zermatt, CH");
  const [searchError, setSearchError] = useState<string | null>(null);

  // Accessibility Toggles
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(true);
  const [accessibility, setAccessibility] = useState({
    highContrast: false,
    darkMode: true,
    dyslexiaFont: false,
    largeCursor: false,
    highlightLinks: false,
    reduceMotion: false,
    readingGuide: false,
    hideImages: false,
  });

  // Global Settings Modal & Video Tour Modal
  const [globalModalOpen, setGlobalModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [addTokenModalOpen, setAddTokenModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenCategory, setNewTokenCategory] = useState("colors");
  const [newTokenVal, setNewTokenVal] = useState("#8b5cf6");
  const tokenFileInputRef = useRef<HTMLInputElement>(null);

  // Design Tokens State
  const [paletteShades, setPaletteShades] = useState<Record<string, string>>({
    "50": "#f5f3ff",
    "100": "#ede9fe",
    "200": "#ddd6fe",
    "300": "#c4b5fd",
    "400": "#a78bfa",
    "500": "#8b5cf6",
    "600": "#7c3aed",
    "700": "#6d28d9",
    "800": "#5b21b6",
    "900": "#4c1d95",
  });
  const [customTokens, setCustomTokens] = useState<Array<{ name: string; category: string; value: string }>>([
    { name: "brand-purple", category: "colors", value: "#7c3aed" },
    { name: "accent-pink", category: "colors", value: "#ec4899" },
  ]);
  const [selectedFont, setSelectedFont] = useState("Plus Jakarta Sans");
  const [activeTypoChip, setActiveTypoChip] = useState("H1");
  const [layoutStretch, setLayoutStretch] = useState("Stretch");
  const [layoutWidth, setLayoutWidth] = useState("Auto");
  const [layoutMargin, setLayoutMargin] = useState("24px");
  const [layoutGutter, setLayoutGutter] = useState("16px");

  // Restore saved design tokens on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("forgestudio_design_tokens");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.palette) setPaletteShades(parsed.palette);
        if (parsed.font) setSelectedFont(parsed.font);
        if (parsed.layout) {
          if (parsed.layout.layoutStretch) setLayoutStretch(parsed.layout.layoutStretch);
          if (parsed.layout.layoutWidth) setLayoutWidth(parsed.layout.layoutWidth);
          if (parsed.layout.layoutMargin) setLayoutMargin(parsed.layout.layoutMargin);
          if (parsed.layout.layoutGutter) setLayoutGutter(parsed.layout.layoutGutter);
        }
        if (parsed.customTokens) setCustomTokens(parsed.customTokens);
      }
    } catch (err) {
      console.warn("Could not load stored tokens", err);
    }
  }, []);

  // Save Tokens & Apply to Website state
  const [isSavingTokens, setIsSavingTokens] = useState(false);
  const [isApplyingTokens, setIsApplyingTokens] = useState(false);

  // Prompt states
  const [mainPrompt, setMainPrompt] = useState(
    "Design a modern high-contrast outdoor apparel e-commerce landing page with neon purple highlights and dynamic collections."
  );
  const [describePrompt, setDescribePrompt] = useState(
    "A premium adventure & outdoor gear brand called FIKRISHOP. We sell all-weather camping essentials, hiking packs, and technical jackets. We want an editorial neon dark aesthetic with vibrant purple accents."
  );
  const [aiCommand, setAiCommand] = useState("");
  const [selectedModel, setSelectedModel] = useState("Claude 4.8");
  const [selectedBuild, setSelectedBuild] = useState("Build v2.4");
  const [selectedMode, setSelectedMode] = useState("Default");
  const [activeQuickAction, setActiveQuickAction] = useState<string>("design");
  const [promptError, setPromptError] = useState<string | null>(null);

  // File Attachments
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const promptTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Mic / Speech
  const [isListening, setIsListening] = useState(false);

  // Screen 4 Suggestions Checklist
  const [suggestions, setSuggestions] = useState({
    improveContent: false,
    generateImages: false,
    suggestLayout: false,
    adjustStyle: false,
  });

  // Pages selection
  const [selectedPages, setSelectedPages] = useState({
    home: true,
    about: false,
    pricing: false,
    contact: false,
  });

  // Target website context and real AI changeset state
  const [activeWebsiteId, setActiveWebsiteId] = useState<string | null>(() => searchParams.get("websiteId") || null);
  const [userWebsites, setUserWebsites] = useState<Array<{ id: string; name: string; documentVersion: number }>>([]);
  const [pendingChangeset, setPendingChangeset] = useState<any>(null);
  const [aiCapabilities, setAiCapabilities] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/websites", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.websites) ? data.websites : Array.isArray(data) ? data : [];
        setUserWebsites(list);
        if (!activeWebsiteId && list.length > 0) {
          setActiveWebsiteId(list[0].id);
        }
      })
      .catch(() => null);

    fetch("/api/v1/ai/capabilities", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAiCapabilities(data);
      })
      .catch(() => null);
  }, [activeWebsiteId]);

  // UI States
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(CODE_SNIPPET);
    setIsCopied(true);
    showToast("Code copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFormatCode = () => {
    showToast("Formatted HeroSection.tsx successfully");
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const sizeKB = Math.round(file.size / 1024) || 1;
      setAttachedFiles((prev) => [...prev, { name: file.name, size: `${sizeKB} KB` }]);
      showToast(`Attached ${file.name}`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    showToast("Attachment removed");
  };

  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      if (!isListening) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.onstart = () => {
            setIsListening(true);
            showToast("Listening... Speak your idea");
          };
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setMainPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
            setIsListening(false);
            showToast("Voice prompt captured!");
          };
          recognition.onerror = () => setIsListening(false);
          recognition.onend = () => setIsListening(false);
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    } else {
      setIsListening((prev) => !prev);
      if (!isListening) {
        showToast("Voice listening simulated: Speak your prompt");
        setTimeout(() => {
          setIsListening(false);
          setMainPrompt((p) => `${p} with high converting visual blocks and dark theme.`);
          showToast("Voice prompt added to editor");
        }, 2000);
      }
    }
  };

  const handleQuickStarter = (promptText: string) => {
    setMainPrompt(promptText);
    setDescribePrompt(promptText);
    setPromptError(null);
    promptTextareaRef.current?.focus();
    showToast("Loaded starter idea into prompt editor");
  };

  const handleSelectQuickAction = (actionKey: string, promptText: string) => {
    setActiveQuickAction(actionKey);
    setMainPrompt(promptText);
    setPromptError(null);
    showToast(`Switched mode to ${actionKey}`);
  };

  const handleGenerateStep1 = async () => {
    if (!mainPrompt.trim()) {
      setPromptError("Please enter an idea prompt before generating.");
      return;
    }
    setPromptError(null);
    setIsGenerating(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast("Please log in to generate proposals");
        setIsGenerating(false);
        return;
      }

      // Query capabilities
      const capRes = await fetch("/api/v1/ai/capabilities", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

      if (capRes && capRes.available === false && capRes.design?.available === false) {
        setPromptError("AI generation is not configured. An administrator must configure an AI provider (OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY) on the server.");
        setIsGenerating(false);
        return;
      }

      // If activeWebsiteId is available, execute real AI assistant request
      if (activeWebsiteId) {
        const siteRes = await fetch(`/api/websites/${activeWebsiteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const siteData = await siteRes.json().catch(() => null);
        const version = siteData?.website?.documentVersion;
        if (!siteRes.ok || typeof version !== "number") {
          setPromptError("Could not retrieve current website document state. Please reload the website.");
          setIsGenerating(false);
          return;
        }

        const res = await fetch(`/api/v1/ai/websites/${activeWebsiteId}/assistant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Forge-Intent": "document-command",
            "Idempotency-Key": `gen-step1-${Date.now()}`,
            "If-Match": `"${activeWebsiteId}:document:${version}"`,
          },
          body: JSON.stringify({
            prompt: mainPrompt,
            expectedVersion: version,
            context: { scope: "site", operation: "SITE_GENERATION" },
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.code === "DOCUMENT_VERSION_CONFLICT") {
            setPromptError("The website was updated concurrently. Please reload and generate again.");
          } else if (data?.code === "DOCUMENT_PRECONDITION_REQUIRED") {
            setPromptError("Authoritative document version required. Please reload the website.");
          } else {
            const errMsg = data?.detail || data?.error?.message || data?.message || "AI generation failed";
            setPromptError(errMsg);
          }
          setIsGenerating(false);
          return;
        }

        if (data?.result?.changeset) {
          setPendingChangeset(data.result.changeset);
          showToast("AI proposal generated!");
        }
      }

      setIsGenerating(false);
      setCurrentStep("describe");
      showToast("Generated layout proposal!");
    } catch (err: any) {
      setIsGenerating(false);
      setPromptError(err?.message || "An unexpected error occurred during generation.");
    }
  };

  const handleSubmitDescribe = async () => {
    const promptToSubmit = describePrompt.trim() || mainPrompt.trim();
    if (!promptToSubmit) {
      showToast("Please enter a description before submitting.");
      return;
    }
    setIsGenerating(true);
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("Please log in to generate proposals");
      setIsGenerating(false);
      return;
    }

    try {
      if (activeWebsiteId) {
        const siteRes = await fetch(`/api/websites/${activeWebsiteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const siteData = await siteRes.json().catch(() => null);
        const version = siteData?.website?.documentVersion;
        if (!siteRes.ok || typeof version !== "number") {
          showToast("Could not retrieve website document version. Please reload.");
          setIsGenerating(false);
          return;
        }

        const res = await fetch(`/api/v1/ai/websites/${activeWebsiteId}/assistant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Forge-Intent": "document-command",
            "Idempotency-Key": `desc-step2-${Date.now()}`,
            "If-Match": `"${activeWebsiteId}:document:${version}"`,
          },
          body: JSON.stringify({
            prompt: promptToSubmit,
            expectedVersion: version,
            context: { scope: "site", operation: "LAYOUT_GENERATION", model: selectedModel },
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.code === "DOCUMENT_VERSION_CONFLICT") {
            showToast("The website was updated concurrently. Please reload.");
          } else if (data?.code === "DOCUMENT_PRECONDITION_REQUIRED") {
            showToast("Document version required. Please reload.");
          } else {
            const errMsg = data?.detail || data?.error?.message || data?.message || "AI generation failed";
            showToast(errMsg);
          }
          setIsGenerating(false);
          return;
        }

        if (data?.result?.changeset) {
          setPendingChangeset(data.result.changeset);
          showToast("AI proposal generated!");
        }
      }

      setIsGenerating(false);
      setCurrentStep("select-pages");
      setViewMode("preview");
      showToast("Generated layout and interactive components");
    } catch (err: any) {
      setIsGenerating(false);
      showToast(err?.message || "An unexpected error occurred during generation.");
    }
  };

  const handleRunAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiCommand.trim()) return;
    const commandText = aiCommand;
    setAiCommand("");
    showToast(`AI executing: "${commandText}"...`);

    const token = localStorage.getItem("token");
    if (!token || !activeWebsiteId) {
      showToast("Sign in and select a website to execute AI commands");
      return;
    }

    try {
      const siteRes = await fetch(`/api/websites/${activeWebsiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const siteData = await siteRes.json().catch(() => null);
      const version = siteData?.website?.documentVersion;
      if (!siteRes.ok || typeof version !== "number") {
        showToast("Could not retrieve current website document state. Please reload.");
        return;
      }

      const res = await fetch(`/api/v1/ai/websites/${activeWebsiteId}/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Forge-Intent": "document-command",
          "Idempotency-Key": `cmd-${Date.now()}`,
          "If-Match": `"${activeWebsiteId}:document:${version}"`,
        },
        body: JSON.stringify({
          prompt: commandText,
          expectedVersion: version,
          context: {
            selectedLayer,
            activePage: activeBuilderPage,
            model: selectedModel,
            suggestions,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "DOCUMENT_VERSION_CONFLICT") {
          showToast("Website changed concurrently. Please reload.");
        } else if (data?.code === "DOCUMENT_PRECONDITION_REQUIRED") {
          showToast("Document version required. Please reload.");
        } else {
          const errMsg = data?.detail || data?.error?.message || data?.message || "AI command failed";
          showToast(errMsg);
        }
        return;
      }

      if (data?.result?.changeset) {
        setPendingChangeset(data.result.changeset);
        showToast(`Changeset proposed for ${data.intent || "update"}. Review and Apply.`);
      } else {
        showToast(`AI completed: ${data?.intent ? data.intent.replace(/_/g, " ") : "Success"}`);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to execute AI command");
    }
  };

  const handleApplyPendingChangeset = async () => {
    if (!pendingChangeset?.id || !activeWebsiteId) return;
    const token = localStorage.getItem("token");
    try {
      // Check current website document version to prevent conflict before applying
      const siteRes = await fetch(`/api/websites/${activeWebsiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const siteData = await siteRes.json().catch(() => null);
      const currentVersion = siteData?.website?.documentVersion;
      if (typeof currentVersion === "number" && currentVersion !== pendingChangeset.expectedDocumentVersion) {
        showToast("The website changed after this proposal was generated. Please reload to generate a new proposal.");
        return;
      }

      showToast("Applying changes to website...");
      const res = await fetch(`/api/v1/ai/changesets/${pendingChangeset.id}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Forge-Intent": "document-command",
          "Idempotency-Key": `apply-${pendingChangeset.id}`,
          "If-Match": `"${activeWebsiteId}:document:${pendingChangeset.expectedDocumentVersion}"`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "DOCUMENT_VERSION_CONFLICT") {
          showToast("Website was updated concurrently. Cannot apply stale changeset.");
        } else {
          showToast(data?.detail || data?.error?.message || data?.message || "Failed to apply changeset");
        }
        return;
      }
      setPendingChangeset(null);
      showToast("Changes successfully applied and saved to website!");
    } catch (err: any) {
      showToast(err?.message || "Failed to apply changeset");
    }
  };

  const handleDiscardPendingChangeset = async () => {
    if (!pendingChangeset?.id) return;
    const token = localStorage.getItem("token");
    try {
      await fetch(`/api/v1/ai/changesets/${pendingChangeset.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingChangeset(null);
      showToast("Changeset discarded.");
    } catch (err: any) {
      showToast(err?.message || "Failed to discard changeset");
    }
  };

  // Advanced Builder Handlers
  const handleAddPage = () => {
    const pageName = window.prompt("Enter new page name:", `Page ${builderPages.length + 1}`);
    if (pageName && pageName.trim()) {
      const newId = pageName.toLowerCase().replace(/\s+/g, "-");
      setBuilderPages((prev) => [...prev, { id: newId, name: pageName.trim(), icon: "file" }]);
      setActiveBuilderPage(newId);
      showToast(`Created page "${pageName.trim()}"`);
    }
  };

  const handleDeletePage = (id: string, name: string) => {
    if (id === "home") {
      showToast("The Home page is protected and cannot be deleted.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      setBuilderPages((prev) => prev.filter((p) => p.id !== id));
      if (activeBuilderPage === id) {
        setActiveBuilderPage("home");
      }
      showToast(`Deleted page "${name}"`);
    }
  };

  const handleInsertBlock = (blockName: string) => {
    showToast(`Inserted "${blockName}" block into ${activeBuilderPage} page`);
  };

  const handleUploadAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      showToast(`Asset "${file.name}" uploaded successfully!`);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    setHiddenLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
    );
  };

  const handleSearchAdventure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryDate || !returnDate) {
      setSearchError("Please select both delivery and return dates.");
      return;
    }
    if (new Date(returnDate) < new Date(deliveryDate)) {
      setSearchError("Return date cannot precede delivery date.");
      return;
    }
    setSearchError(null);
    showToast(`Found 18 available ${gearType} rentals in ${searchLocation}!`);
  };

  const toggleAccessibility = (key: keyof typeof accessibility) => {
    setAccessibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      showToast(`${key} mode: ${next[key] ? "Enabled" : "Disabled"}`);
      return next;
    });
  };

  const handleApplyTokens = () => {
    setIsApplyingTokens(true);
    setTimeout(() => {
      setIsApplyingTokens(false);
      showToast("Design tokens applied to live website preview!");
    }, 400);
  };

  const handleSaveTokens = () => {
    setIsSavingTokens(true);
    localStorage.setItem(
      "forgestudio_design_tokens",
      JSON.stringify({
        palette: paletteShades,
        font: selectedFont,
        layout: { layoutStretch, layoutWidth, layoutMargin, layoutGutter },
        customTokens,
      })
    );
    setTimeout(() => {
      setIsSavingTokens(false);
      showToast("Design tokens saved successfully!");
    }, 400);
  };

  const handleExportTokens = () => {
    const data = JSON.stringify(
      {
        theme: tokenTheme,
        palette: paletteShades,
        font: selectedFont,
        typoScales: [
          { name: "H1", val: "56/120" },
          { name: "H2", val: "40/120" },
          { name: "H3", val: "32/120" },
          { name: "H4", val: "24/120" },
          { name: "Body", val: "16/28" },
          { name: "Caption", val: "12/20" },
        ],
        spacing: {
          scale: ["4", "8", "12", "16", "24", "32", "48", "64"],
          stretch: layoutStretch,
          width: layoutWidth,
          margin: layoutMargin,
          gutter: layoutGutter,
        },
        customTokens,
      },
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "design-tokens.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported design tokens as JSON file");
  };

  const handleImportTokens = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.palette) setPaletteShades(parsed.palette);
        if (parsed.font) setSelectedFont(parsed.font);
        if (parsed.spacing) {
          if (parsed.spacing.margin) setLayoutMargin(parsed.spacing.margin);
          if (parsed.spacing.gutter) setLayoutGutter(parsed.spacing.gutter);
        }
        if (parsed.customTokens) setCustomTokens(parsed.customTokens);
        showToast("Imported design tokens successfully!");
      } catch {
        showToast("Error importing tokens: Invalid JSON format");
      }
    };
    reader.readAsText(file);
  };

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) {
      showToast("Token name cannot be empty");
      return;
    }
    setCustomTokens((prev) => [
      ...prev,
      { name: newTokenName.trim(), category: newTokenCategory, value: newTokenVal.trim() },
    ]);
    setAddTokenModalOpen(false);
    setNewTokenName("");
    showToast(`Added token "${newTokenName.trim()}"`);
  };

  const CODE_SNIPPET = `import React from 'react';
import { ArrowRight, PlayCircle } from 'lucide-react';

// Responsive outdoor apparel hero component with vibrant purple glow
export const HeroSection = () => {
  return (
    <section className="relative min-h-[480px] flex items-center px-8 lg:px-14 overflow-hidden bg-[#0c0d14]">
      {/* Scenic Mountain Background Layer */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('/mountains.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c13] via-[#0a0c13]/80 to-transparent" />

      <div className="relative z-10 max-w-xl py-12">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
          EXPLORE MORE
        </span>
        <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mt-3">
          Gear up for <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 glow-purple">
            bigger
          </span> adventures.
        </h1>
        <p className="text-xs text-slate-300/80 mt-4 leading-relaxed max-w-md">
          Premium outdoor gear, flexible rentals, and unforgettable adventures.
        </p>
        <div className="flex items-center space-x-3 mt-7">
          <button className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold">
            Shop All Gear
          </button>
          <button className="px-4 py-2.5 rounded-full bg-black/40 border border-white/20 text-white font-semibold">
            Watch Video
          </button>
        </div>
      </div>
    </section>
  );
};`;

  return (
    <div className="ai-studio-root">
      {/* ================= TOP HEADER ================= */}
      <header className="ai-header">
        <div className="ai-header-left">
          <button
            className="ai-back-btn"
            onClick={() => {
              if (currentStep === "builder") setCurrentStep("select-pages");
              else if (currentStep === "select-pages") {
                if (viewMode === "code") setViewMode("preview");
                else setCurrentStep("describe");
              }
              else if (currentStep === "describe") setCurrentStep("prompt");
              else navigate("/dashboard");
            }}
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <Link to="/dashboard" className="ai-brand">
            web studio
          </Link>

          {currentStep !== "prompt" && (
            <>
              <div className="ai-header-sep" />
              <div className="ai-site-meta">
                <div className="ai-site-meta-top">
                  <span className="ai-site-title">Summer Sale Landing</span>
                  <span className="ai-draft-badge">Draft</span>
                </div>
                <span className="ai-breadcrumbs">
                  Ecommerce / Campaigns / Summer Sale
                </span>
              </div>
            </>
          )}
        </div>

        {/* Center Device Switcher & Zoom (Screens 2, 3, 4) */}
        {currentStep !== "prompt" && (
          <div className="ai-header-center">
            <div className="ai-device-toggle-group">
              <button
                className={`ai-device-btn ${deviceMode === "desktop" ? "active" : ""}`}
                onClick={() => setDeviceMode("desktop")}
                title="Desktop View"
              >
                <Monitor size={15} />
              </button>
              <button
                className={`ai-device-btn ${deviceMode === "tablet" ? "active" : ""}`}
                onClick={() => setDeviceMode("tablet")}
                title="Tablet View"
              >
                <Tablet size={15} />
              </button>
              <button
                className={`ai-device-btn ${deviceMode === "mobile" ? "active" : ""}`}
                onClick={() => setDeviceMode("mobile")}
                title="Mobile View"
              >
                <Smartphone size={15} />
              </button>
            </div>

            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(e.target.value)}
              className="ai-zoom-select"
            >
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
              <option value="125%">125%</option>
            </select>
          </div>
        )}

        {/* Header Right Actions */}
        <div className="ai-header-right">
          {currentStep === "select-pages" && (
            <button
              className={`ai-icon-btn ${viewMode === "code" ? "active" : ""}`}
              onClick={() => setViewMode((prev) => (prev === "code" ? "preview" : "code"))}
              title={viewMode === "code" ? "Switch to Live Preview" : "Switch to Code Editor"}
            >
              <Code2 size={16} />
            </button>
          )}

          <button
            className="ai-icon-btn"
            title="Undo"
            onClick={() => showToast("Undo action")}
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="ai-icon-btn"
            title="Redo"
            onClick={() => showToast("Redo action")}
          >
            <RotateCw size={15} />
          </button>
          <button
            className="ai-icon-btn"
            title="Notifications"
            onClick={() => navigate("/settings/notifications")}
          >
            <Bell size={15} />
          </button>

          {currentStep === "prompt" ? (
            <>
              <Link to="/subscriptions" className="ws-upgrade-btn" style={{ height: 32, padding: "0 14px" }}>
                Upgrade <span>→</span>
              </Link>
              <HeaderUserDropdown />
            </>
          ) : (
            <>
              <button
                className="ai-preview-btn"
                onClick={() => setViewMode((prev) => (prev === "preview" ? "code" : "preview"))}
              >
                <Eye size={14} />
                <span>{viewMode === "preview" ? "Code" : "Preview"}</span>
              </button>
              <button
                className="ai-publish-btn"
                onClick={() => setPublishModalOpen(true)}
              >
                <Send size={13} />
                <span>Publish →</span>
              </button>
            </>
          )}
        </div>
      </header>
      {pendingChangeset && (
        <div style={{ position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)", zIndex: 99999, width: "90%", maxWidth: 840 }}>
          <div style={{ background: "linear-gradient(135deg, rgba(30, 27, 75, 0.96), rgba(49, 46, 129, 0.96))", border: "1px solid rgba(129, 140, 248, 0.5)", borderRadius: 16, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)", backdropFilter: "blur(12px)" }}>
            <div>
              <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                AI Proposed Changeset ({pendingChangeset.summary?.operation || "Proposal"})
              </div>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 600 }}>
                {pendingChangeset.summary?.summary || "AI proposed modifications to your website document. Review and accept when ready."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={handleApplyPendingChangeset} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Apply to Website
              </button>
              <button type="button" onClick={handleDiscardPendingChangeset} style={{ background: "rgba(255,255,255,0.1)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN STUDIO BODY ================= */}
      <div className="ai-studio-body">
        {/* Left Primary Icon Rail */}
        <aside className="ai-studio-rail">
          <div className="ai-rail-top">
            <button
              className="ai-rail-add-btn"
              onClick={() => navigate("/dashboard")}
              title="Add"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>

            <nav className="ai-rail-nav">
              <button className="ai-rail-nav-item" onClick={() => navigate("/dashboard")}>
                <FileText size={17} />
                <span>Pages</span>
              </button>
              <button className="ai-rail-nav-item" onClick={() => navigate("/dashboard")}>
                <Blocks size={17} />
                <span>Blocks</span>
              </button>
              <button className="ai-rail-nav-item" onClick={() => navigate("/dashboard")}>
                <Layout size={17} />
                <span>Templates</span>
              </button>
              <button className="ai-rail-nav-item" onClick={() => navigate("/dashboard")}>
                <Shapes size={17} />
                <span>Elements</span>
              </button>
              <button
                className="ai-rail-nav-item active"
                onClick={() => setCurrentStep("prompt")}
                title="AI Studio"
              >
                <Sparkles size={17} />
                <span>AI</span>
              </button>
            </nav>
          </div>

          <div className="ai-rail-bottom">
            <Link to="/settings/account" className="ai-rail-settings-btn" title="Settings">
              <SettingsIcon size={18} />
              <span>Settings</span>
            </Link>
          </div>
        </aside>

        {/* Workspace Central Area */}
        <main className="ai-workspace">
          {/* ============================================================
              SCREEN 1: WHAT DO YOU WANT TO MAKE? (Ai dashbord.pdf)
              ============================================================ */}
          {currentStep === "prompt" && (
            <div className="ai-prompt-screen-content">
              {/* Badge */}
              <div className="ai-engine-chip">
                <span className="ai-engine-dot" />
                <span>Next-Gen AI Engine v2.4 Active</span>
              </div>

              {/* Title */}
              <h1 className="ai-hero-title">
                What do you want to <span className="ai-hero-title-make">make?</span>
              </h1>
              <p className="ai-hero-subtitle">
                Turn your ideas into real designs, interactive prototypes, and
                production-ready applications with the power of AI.
              </p>

              {/* Card */}
              <div className="ai-prompt-card">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileAttach}
                  accept="image/*,.pdf,.fig,.sketch,.json"
                />

                {attachedFiles.length > 0 && (
                  <div className="ai-attachment-chips-wrap">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="ai-attachment-chip">
                        <Paperclip size={12} />
                        <span>{file.name} ({file.size})</span>
                        <button
                          type="button"
                          className="ai-attachment-remove"
                          onClick={() => removeAttachment(idx)}
                          title="Remove attachment"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  ref={promptTextareaRef}
                  className="ai-prompt-textarea"
                  value={mainPrompt}
                  onChange={(e) => {
                    setMainPrompt(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  placeholder="Describe your idea. Attach a design to guide the result..."
                  rows={4}
                />

                {promptError && (
                  <div className="ai-prompt-error-msg">{promptError}</div>
                )}

                <div className="ai-prompt-toolbar">
                  <div className="ai-prompt-toolbar-left">
                    <button
                      className="ai-tool-pill-btn"
                      title="Attach design or assets"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="ai-tool-pill-btn"
                      title="Layers"
                      onClick={() => showToast("Layers inspector active")}
                    >
                      <Layers size={14} />
                    </button>

                    <select
                      value={selectedBuild}
                      onChange={(e) => setSelectedBuild(e.target.value)}
                      className="ai-tool-pill-btn"
                    >
                      <option value="Build v2.4">Build v2.4</option>
                      <option value="Build v2.3">Build v2.3</option>
                      <option value="Build v3.0-Beta">Build v3.0-Beta</option>
                    </select>

                    <select
                      value={selectedMode}
                      onChange={(e) => setSelectedMode(e.target.value)}
                      className="ai-tool-pill-btn"
                    >
                      <option value="Default">Mode: Default</option>
                      <option value="High-Fidelity">Mode: High Fidelity</option>
                      <option value="Wireframe">Mode: Rapid Wireframe</option>
                    </select>
                  </div>

                  <div className="ai-prompt-toolbar-right">
                    <button
                      className={`ai-mic-btn ${isListening ? "listening" : ""}`}
                      title={isListening ? "Listening... click to stop" : "Speech to Prompt"}
                      onClick={handleToggleMic}
                    >
                      <Mic size={16} />
                    </button>
                    <button
                      className="ai-generate-main-btn"
                      onClick={handleGenerateStep1}
                    >
                      {isGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <span>Generate</span>
                      )}
                      <span>↑</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Suggestion Pills */}
              <div className="ai-pills-row">
                <button
                  className={`ai-action-pill ${activeQuickAction === "design" ? "active" : ""}`}
                  onClick={() =>
                    handleSelectQuickAction(
                      "design",
                      "Design a responsive SaaS landing page with dark neon theme and interactive pricing cards."
                    )
                  }
                >
                  🌐 Design with Ai
                </button>
                <button
                  className={`ai-action-pill ${activeQuickAction === "content" ? "active" : ""}`}
                  onClick={() =>
                    handleSelectQuickAction(
                      "content",
                      "Write compelling marketing copy and feature benefit headers for an AI productivity app."
                    )
                  }
                >
                  📊 Write content
                </button>
                <button
                  className={`ai-action-pill ${activeQuickAction === "image" ? "active" : ""}`}
                  onClick={() =>
                    handleSelectQuickAction(
                      "image",
                      "Generate high-resolution hero illustrations with futuristic purple glow and minimal typography."
                    )
                  }
                >
                  📱 Generate image
                </button>
                <button
                  className={`ai-action-pill ${activeQuickAction === "landing" ? "active" : ""}`}
                  onClick={() =>
                    handleSelectQuickAction(
                      "landing",
                      "Generate a high-converting summer sale landing page with countdown timer and adventure gear grid."
                    )
                  }
                >
                  🚀 Landing Page
                </button>
                <button
                  className={`ai-action-pill ${activeQuickAction === "summarize" ? "active" : ""}`}
                  onClick={() =>
                    handleSelectQuickAction(
                      "summarize",
                      "Summarize the product specifications into 4 digestible bullet points with checkmark icons."
                    )
                  }
                >
                  🧊 Summarize text
                </button>
              </div>

              {/* Quick Starter Ideas */}
              <div className="ai-starters-section">
                <div className="ai-starters-header">
                  <div className="ai-starters-title">
                    <Sparkles size={14} color="#a855f7" />
                    <span>QUICK STARTER IDEAS</span>
                  </div>
                  <span className="ai-starters-hint">Click to load into editor</span>
                </div>

                <div className="ai-starters-grid">
                  <div
                    className="ai-starter-card"
                    onClick={() =>
                      handleQuickStarter(
                        "Generate a complete landing page in hero section."
                      )
                    }
                  >
                    <div className="ai-starter-card-title">Landing page</div>
                    <div className="ai-starter-card-desc">
                      Generate a complete landing page in hero section.
                    </div>
                  </div>

                  <div
                    className="ai-starter-card"
                    onClick={() =>
                      handleQuickStarter(
                        "Write compelling product copy."
                      )
                    }
                  >
                    <div className="ai-starter-card-title">Product descriptions</div>
                    <div className="ai-starter-card-desc">
                      Write compelling product copy.
                    </div>
                  </div>

                  <div
                    className="ai-starter-card"
                    onClick={() =>
                      handleQuickStarter(
                        "Generate a content section with form."
                      )
                    }
                  >
                    <div className="ai-starter-card-title">Contact section</div>
                    <div className="ai-starter-card-desc">
                      Generate a content section with form.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              SCREEN 2: DESCRIBE YOUR SITE (Ai dashbord-2.pdf)
              ============================================================ */}
          {currentStep === "describe" && (
            <div className="ai-screen-2-layout">
              {/* Left Describe Card */}
              <div className="ai-describe-panel">
                <div className="ai-describe-panel-top">
                  <h2 className="ai-describe-panel-title">Describe your site</h2>
                  <div className="ai-sparkle-badge">
                    <Sparkles size={15} />
                  </div>
                </div>

                <p className="ai-describe-panel-helper">
                  What are you building? Share the business, the audience, the
                  goal, and any style you have in mind — a few sentences is
                  plenty.
                </p>

                <textarea
                  className="ai-describe-textarea"
                  value={describePrompt}
                  onChange={(e) => setDescribePrompt(e.target.value)}
                  placeholder="Enter prompt..."
                />

                <div className="ai-describe-panel-footer">
                  <button
                    className="ai-submit-purple-btn"
                    onClick={handleSubmitDescribe}
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : "Submit"}
                  </button>
                </div>
              </div>

              {/* Right Wireframe Preview Canvas */}
              <div className="ai-wireframe-canvas-wrap">
                <div className="ai-canvas-tag-label">
                  Live layout preview: Editorial Neon
                </div>

                <div className="ai-wireframe-neon-box">
                  {/* Browser top */}
                  <div className="ai-browser-bar">
                    <div className="ai-browser-dots">
                      <div className="ai-browser-dot" />
                      <div className="ai-browser-dot" />
                      <div className="ai-browser-dot" />
                    </div>
                    <div className="ai-browser-lines">
                      <div className="ai-browser-line" />
                      <div className="ai-browser-line" />
                      <div className="ai-browser-line" />
                    </div>
                  </div>

                  {/* Wireframe Hero Aa */}
                  <div className="ai-wireframe-hero">
                    <div className="ai-wireframe-aa">Aa</div>
                    <div className="ai-wireframe-bar-1" />
                    <div className="ai-wireframe-bar-2" />
                  </div>

                  {/* Wireframe Bottom Cards */}
                  <div className="ai-wireframe-cards-row">
                    <div className="ai-wireframe-card">
                      <ImageIcon size={28} />
                    </div>
                    <div className="ai-wireframe-card">
                      <ImageIcon size={28} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              SCREEN 3: SELECT PAGES & FIKRISHOP STORE PREVIEW (Ai dashbord-4.pdf)
              SCREEN 4: SELECT PAGES & AI CODE EDITOR (Ai dashbord-3.pdf)
              ============================================================ */}
          {currentStep === "select-pages" && (
            <div className="ai-screen-3-layout" style={{ height: "100%" }}>
              {/* LEFT PANEL: SELECT PAGES TO INCLUDE */}
              <div className="ai-select-pages-panel">
                <div>
                  <div className="ai-select-panel-header">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <h2 className="ai-panel-title">Select pages to include</h2>
                      <div className="ai-sparkle-badge">
                        <Sparkles size={15} />
                      </div>
                    </div>
                    <p className="ai-panel-sub">
                      Choose the pages you want to keep building.
                      <br />
                      You can always add or remove pages later.
                    </p>
                  </div>

                  <div className="ai-pages-list">
                    <div
                      className="ai-page-item-row"
                      onClick={() => setSelectedPages((p) => ({ ...p, home: !p.home }))}
                    >
                      <div className="ai-page-item-left">
                        <input
                          type="checkbox"
                          checked={selectedPages.home}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedPages((p) => ({ ...p, home: e.target.checked }));
                          }}
                          className="ai-page-checkbox"
                        />
                        <span>Home page</span>
                      </div>
                      <span className="ai-page-badge">
                        {selectedPages.home ? "1 selected" : "0 selected"}
                      </span>
                    </div>
                  </div>

                  {/* Suggestion Checklist (Screen 3 / Ai dashbord-4.pdf) */}
                  {viewMode === "preview" && (
                    <div className="ai-suggestions-list">
                      <div className="ai-suggestions-title">Suggestion</div>
                      {[
                        { key: "improveContent", label: "Improve content" },
                        { key: "generateImages", label: "Generate images" },
                        { key: "suggestLayout", label: "Suggest a layout" },
                        { key: "adjustStyle", label: "Adjust design style" },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="ai-suggestion-row"
                          onClick={() => {
                            setSuggestions((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key as keyof typeof suggestions],
                            }));
                            showToast(`Suggestion toggled: ${item.label}`);
                          }}
                        >
                          <span>{item.label}</span>
                          <input
                            type="checkbox"
                            checked={suggestions[item.key as keyof typeof suggestions]}
                            onChange={() => {}}
                            className="ai-page-checkbox"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Command Composer Box */}
                  <form onSubmit={handleRunAiCommand} className="ai-command-box">
                    {viewMode === "preview" && (
                      <div className="ai-command-tag">
                        <Shapes size={12} />
                        <span>section</span>
                        <X
                          size={11}
                          style={{ cursor: "pointer" }}
                          onClick={() => showToast("Deselected section")}
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      className="ai-command-input"
                      value={aiCommand}
                      onChange={(e) => setAiCommand(e.target.value)}
                      placeholder="Type your AI command here..."
                    />
                    <div className="ai-command-bottom-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#8c85ae",
                            cursor: "pointer",
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          title="Attach file"
                        >
                          <Paperclip size={14} />
                        </button>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="ai-model-select"
                        >
                          <option value="Claude 4.8">Claude 4.8</option>
                          <option value="GPT-4o">GPT-4o</option>
                          <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                        </select>
                      </div>
                      <button type="submit" className="ai-send-btn" title="Send AI Command">
                        <Send size={12} />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Bottom Navigation */}
                <div className="ai-select-panel-nav">
                  <button
                    type="button"
                    className="ai-round-back-btn"
                    onClick={() => {
                      if (viewMode === "code") setViewMode("preview");
                      else setCurrentStep("describe");
                    }}
                    title="Back"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="ai-continue-purple-btn"
                    onClick={() => {
                      if (viewMode === "preview") {
                        setViewMode("code");
                        showToast("Switched to Code Editor (Screen 4)");
                      } else {
                        setCurrentStep("builder");
                        showToast("Opened Advanced Website Builder Dashboard!");
                      }
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>

              {/* RIGHT PANEL: LIVE STORE PREVIEW (Screen 3) OR CODE EDITOR (Screen 4) */}
              {viewMode === "preview" ? (
                /* SCREEN 3: FIKRISHOP STORE PREVIEW (Ai dashbord-4.pdf) */
                <div className="ai-preview-container">
                  {/* Navbar */}
                  <nav className="fikri-nav">
                    <div className="fikri-logo">
                      <span style={{ color: "#a855f7", fontSize: 16 }}>▲</span>
                      <span>FIKRISHOP</span>
                    </div>
                    <div className="fikri-menu">
                      <span className="fikri-menu-link active">Home</span>
                      <span className="fikri-menu-link">Shop</span>
                      <span className="fikri-menu-link">Collections</span>
                      <span className="fikri-menu-link">About</span>
                      <span className="fikri-menu-link">Blog</span>
                    </div>
                    <div className="fikri-nav-actions">
                      <Search size={16} style={{ color: "#cbd5e1", cursor: "pointer" }} />
                      <User size={16} style={{ color: "#cbd5e1", cursor: "pointer" }} />
                      <div style={{ position: "relative", cursor: "pointer" }}>
                        <ShoppingBag size={16} style={{ color: "#cbd5e1" }} />
                        <span
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -8,
                            backgroundColor: "#ec4899",
                            color: "#ffffff",
                            fontSize: 9,
                            fontWeight: 700,
                            borderRadius: "50%",
                            width: 14,
                            height: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          0
                        </span>
                      </div>
                      <button
                        className="fikri-shop-now-btn"
                        onClick={() => showToast("Navigating to shop...")}
                      >
                        Shop Now
                      </button>
                    </div>
                  </nav>

                  {/* Hero Section */}
                  <div
                    className="fikri-hero"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80')",
                    }}
                  >
                    <div className="fikri-hero-overlay" />
                    <div className="fikri-hero-content">
                      <div className="fikri-badge-tag">EXPLORE MORE</div>
                      <h1 className="fikri-hero-h1">
                        Gear up for <br />
                        <span className="fikri-hero-bigger">bigger</span> adventures.
                      </h1>
                      <p className="fikri-hero-desc">
                        Premium outdoor gear, flexible rentals, and unforgettable adventures — wherever you go.
                      </p>
                      <div className="fikri-hero-ctas">
                        <button
                          className="fikri-cta-purple"
                          onClick={() => showToast("Shop All Gear clicked")}
                        >
                          <span>Shop All Gear</span>
                          <span>→</span>
                        </button>
                        <button
                          className="fikri-cta-glass"
                          onClick={() => showToast("Opening video tour...")}
                        >
                          <Play size={13} fill="#ffffff" />
                          <span>Watch Video</span>
                        </button>
                      </div>
                    </div>

                    {/* Floating Video Card */}
                    <div
                      className="fikri-video-badge"
                      onClick={() => showToast("Playing demo video (1:24)")}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 32,
                          borderRadius: 6,
                          backgroundImage:
                            "url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=160&q=80')",
                          backgroundSize: "cover",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Play size={12} fill="#ffffff" color="#ffffff" />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#ffffff" }}>
                          See it in action
                        </span>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>1:24</span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Feature Strip */}
                  <div className="fikri-features-bar">
                    <div className="fikri-feature-item">
                      <Truck size={18} color="#a855f7" />
                      <div>
                        <div className="fikri-feature-title">Free Delivery</div>
                        <div className="fikri-feature-sub">On orders over $50</div>
                      </div>
                    </div>
                    <div className="fikri-feature-item">
                      <ShieldCheck size={18} color="#a855f7" />
                      <div>
                        <div className="fikri-feature-title">Trusted Quality</div>
                        <div className="fikri-feature-sub">From top brands</div>
                      </div>
                    </div>
                    <div className="fikri-feature-item">
                      <ReturnIcon size={18} color="#a855f7" />
                      <div>
                        <div className="fikri-feature-title">Easy Returns</div>
                        <div className="fikri-feature-sub">Hassle-free process</div>
                      </div>
                    </div>
                    <div className="fikri-feature-item">
                      <Leaf size={18} color="#a855f7" />
                      <div>
                        <div className="fikri-feature-title">Sustainable</div>
                        <div className="fikri-feature-sub">A cleaner tomorrow</div>
                      </div>
                    </div>
                  </div>

                  {/* Featured Collections */}
                  <div className="fikri-collections">
                    <div className="fikri-collections-header">
                      <div>
                        <div className="fikri-collections-tag">FEATURED COLLECTIONS</div>
                        <h2 className="fikri-collections-h2">Shop by adventure.</h2>
                      </div>
                      <span
                        className="fikri-collections-link"
                        onClick={() => showToast("Viewing all collections")}
                      >
                        View all collections →
                      </span>
                    </div>

                    <div className="fikri-cards-grid">
                      {[
                        {
                          title: "Hiking Gear",
                          img: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=80",
                        },
                        {
                          title: "Camping Essentials",
                          img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80",
                        },
                        {
                          title: "Winter Gear",
                          img: "https://images.unsplash.com/photo-1520333789090-1afc82db536a?auto=format&fit=crop&w=600&q=80",
                        },
                        {
                          title: "Travel Packs",
                          img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
                        },
                      ].map((col) => (
                        <div
                          key={col.title}
                          className="fikri-card"
                          style={{ backgroundImage: `url('${col.img}')` }}
                          onClick={() => showToast(`Opening collection: ${col.title}`)}
                        >
                          <div className="fikri-card-overlay" />
                          <div className="fikri-card-title">{col.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* SCREEN 4: CODE EDITOR (Ai dashbord-3.pdf) */
                <div className="ai-code-editor-container">
                  <div className="ai-editor-tab-bar">
                    <div className="ai-editor-tab">
                      <Code2 size={13} color="#a855f7" />
                      <span>HeroSection.tsx</span>
                      <X size={12} style={{ cursor: "pointer", marginLeft: 4 }} />
                    </div>
                    <div className="ai-editor-actions">
                      <button className="ai-editor-pill-btn" onClick={handleFormatCode}>
                        Format
                      </button>
                      <button className="ai-editor-pill-btn" onClick={handleCopyCode}>
                        {isCopied ? "Copied!" : "Copy"}
                      </button>
                      <button
                        className="ai-editor-sandbox-btn"
                        onClick={() => showToast("Opening isolated sandbox environment")}
                      >
                        <ExternalLink size={12} />
                        <span>Open Sandbox</span>
                      </button>
                    </div>
                  </div>

                  <div className="ai-editor-filepath">
                    src / components / marketing / ⚛ HeroSection.tsx &gt; HeroSection
                  </div>

                  <div className="ai-code-body">
                    <div className="ai-code-lines">
                      {Array.from({ length: 30 }, (_, i) => {
                        const num = (i + 1).toString().padStart(2, "0");
                        return <div key={num}>{num}</div>;
                      })}
                    </div>

                    <div className="ai-code-text">
                      <div><span className="syn-kw">import</span> React <span className="syn-kw">from</span> <span className="syn-str">'react'</span>;</div>
                      <div><span className="syn-kw">import</span> &#123; ArrowRight, PlayCircle &#125; <span className="syn-kw">from</span> <span className="syn-str">'lucide-react'</span>;</div>
                      <div className="syn-comm">// Responsive outdoor apparel hero component with vibrant purple glow</div>
                      <div><span className="syn-kw">export const</span> <span className="syn-fn">HeroSection</span> = () =&gt; &#123;</div>
                      <div>  <span className="syn-kw">return</span> (</div>
                      <div>    &lt;<span className="syn-tag">section</span> <span className="syn-attr">className</span>=<span className="syn-str">"relative min-h-[480px] flex items-center px-8 lg:px-14 overflow-hidden bg-[#0c0d14]"</span>&gt;</div>
                      <div className="syn-comm">      &#123;/* Scenic Mountain Background Layer */&#125;</div>
                      <div>      &lt;<span className="syn-tag">div</span> <span className="syn-attr">className</span>=<span className="syn-str">"absolute inset-0 z-0 bg-cover bg-center opacity-40"</span> <span className="syn-attr">style</span>=&#123;&#123; backgroundImage: <span className="syn-str">"url('/mountains.webp')"</span> &#125;&#125; /&gt;</div>
                      <div>      &lt;<span className="syn-tag">div</span> <span className="syn-attr">className</span>=<span className="syn-str">"absolute inset-0 bg-gradient-to-r from-[#0a0c13] via-[#0a0c13]/80 to-transparent"</span> /&gt;</div>
                      <div>      &lt;<span className="syn-tag">div</span> <span className="syn-attr">className</span>=<span className="syn-str">"relative z-10 max-w-xl py-12"</span>&gt;</div>
                      <div>        &lt;<span className="syn-tag">span</span> <span className="syn-attr">className</span>=<span className="syn-str">"text-[11px] font-extrabold uppercase tracking-widest text-slate-400"</span>&gt;EXPLORE MORE&lt;/<span className="syn-tag">span</span>&gt;</div>
                      <div>        &lt;<span className="syn-tag">h1</span> <span className="syn-attr">className</span>=<span className="syn-str">"text-4xl lg:text-5xl font-black text-white leading-tight mt-3"</span>&gt;</div>
                      <div>          Gear up for &lt;<span className="syn-tag">br</span> /&gt;</div>
                      <div>          &lt;<span className="syn-tag">span</span> <span className="syn-attr">className</span>=<span className="syn-str">"text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400 glow-purple"</span>&gt;</div>
                      <div>            bigger</div>
                      <div>          &lt;/<span className="syn-tag">span</span>&gt; adventures.</div>
                      <div>        &lt;/<span className="syn-tag">h1</span>&gt;</div>
                      <div>        &lt;<span className="syn-tag">p</span> <span className="syn-attr">className</span>=<span className="syn-str">"text-xs text-slate-300/80 mt-4 leading-relaxed max-w-md"</span>&gt;</div>
                      <div>          Premium outdoor gear, flexible rentals, and unforgettable adventures.</div>
                      <div>        &lt;/<span className="syn-tag">p</span>&gt;</div>
                      <div>        &lt;<span className="syn-tag">div</span> <span className="syn-attr">className</span>=<span className="syn-str">"flex items-center space-x-3 mt-7"</span>&gt;</div>
                      <div>          &lt;<span className="syn-tag">button</span> <span className="syn-attr">className</span>=<span className="syn-str">"px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold"</span>&gt;Shop All Gear&lt;/<span className="syn-tag">button</span>&gt;</div>
                      <div>          &lt;<span className="syn-tag">button</span> <span className="syn-attr">className</span>=<span className="syn-str">"px-4 py-2.5 rounded-full bg-black/40 border border-white/20 text-white font-semibold"</span>&gt;Watch Video&lt;/<span className="syn-tag">button</span>&gt;</div>
                      <div>        &lt;/<span className="syn-tag">div</span>&gt;</div>
                      <div>      &lt;/<span className="syn-tag">div</span>&gt;</div>
                      <div>    &lt;/<span className="syn-tag">section</span>&gt;</div>
                      <div>  );</div>
                      <div>&#125;;</div>
                    </div>

                    <div className="ai-minimap">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div
                          key={i}
                          className="ai-minimap-bar"
                          style={{ width: `${30 + ((i * 19) % 65)}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Status Bar matching PDF 3 */}
                  <div className="ai-editor-status-bar">
                    <div className="ai-status-bar-left">
                      <span>Ready</span>
                      <span>TypeScript 5.3</span>
                      <span>Next.js 14.1 (App Router)</span>
                      <span>Prettier on save</span>
                    </div>
                    <div className="ai-status-bar-right">
                      <span>Ln 18, Col 24</span>
                      <span>UTF-8</span>
                      <span>LF</span>
                      <span>Tailwind CSS</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              SCREEN: ADVANCED 3-PANEL WEBSITE BUILDER DASHBOARD
              (advanced dashbord(1).pdf)
              ============================================================ */}
          {currentStep === "builder" && (
            <div className="adv-builder-container">
                  {/* LEFT SECONDARY SIDEBAR (240px) */}
                  {!isPreviewModeOnly && (
                    <aside className="adv-left-sidebar">
                      {/* Top 3 tabs: Pages, Blocks, Assets */}
                      <div className="adv-nav-tabs">
                        <button
                          className={`adv-nav-tab ${leftSidebarTab === "pages" ? "active" : ""}`}
                          onClick={() => setLeftSidebarTab("pages")}
                        >
                          Pages
                        </button>
                        <button
                          className={`adv-nav-tab ${leftSidebarTab === "blocks" ? "active" : ""}`}
                          onClick={() => setLeftSidebarTab("blocks")}
                        >
                          Blocks
                        </button>
                        <button
                          className={`adv-nav-tab ${leftSidebarTab === "assets" ? "active" : ""}`}
                          onClick={() => setLeftSidebarTab("assets")}
                        >
                          Assets
                        </button>
                      </div>

                      {leftSidebarTab === "pages" && (
                        <>
                          {/* PAGES Section */}
                          <div className="adv-sidebar-section">
                            <div className="adv-sidebar-heading">
                              <span>PAGES</span>
                            </div>
                            <div className="adv-pages-list">
                              {builderPages.map((page) => (
                                <div
                                  key={page.id}
                                  className={`adv-page-item ${activeBuilderPage === page.id ? "active" : ""}`}
                                  onClick={() => setActiveBuilderPage(page.id)}
                                >
                                  <div className="adv-page-item-left">
                                    {page.id === "home" ? <Home size={14} /> : <Box size={14} />}
                                    <span>{page.name}</span>
                                  </div>
                                  {page.id !== "home" && (
                                    <button
                                      type="button"
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#6b638a",
                                        cursor: "pointer",
                                        padding: 0,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePage(page.id, page.name);
                                      }}
                                      title="Delete page"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="adv-add-page-btn"
                                onClick={handleAddPage}
                              >
                                <Plus size={14} />
                                <span>Add page</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ height: 1, backgroundColor: "#1c1737", margin: "8px 14px" }} />

                          {/* LAYERS Section */}
                          <div className="adv-sidebar-section" style={{ flex: 1 }}>
                            <div
                              className="adv-sidebar-heading"
                              style={{ cursor: "pointer" }}
                              onClick={() => setIsLayersOpen((prev) => !prev)}
                            >
                              <span>LAYER</span>
                              {isLayersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>

                            {isLayersOpen && (
                              <div className="adv-layer-tree">
                                {/* Root: Homepage */}
                                <div
                                  className="adv-tree-item"
                                  onClick={() => setSelectedLayer("homepage")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ fontSize: 10 }}>▼</span>
                                    <span style={{ fontWeight: 600, color: "#ffffff" }}>Homepage</span>
                                  </div>
                                  <div className="adv-tree-icons">
                                    <Eye size={12} />
                                    <Lock size={12} />
                                  </div>
                                </div>

                                {/* Top Navbar */}
                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "navbar" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("navbar")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Top Navbar</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("navbar");
                                    }}
                                  >
                                    {hiddenLayers.includes("navbar") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                {/* Hero Section Group */}
                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "hero" ? "active" : ""}`}
                                  onClick={() => {
                                    setSelectedLayer("hero");
                                    setIsHeroGroupOpen((prev) => !prev);
                                  }}
                                >
                                  <div className="adv-tree-item-left">
                                    <span>{isHeroGroupOpen ? "▾" : "▸"}</span>
                                    <span>Hero Section</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("hero");
                                    }}
                                  >
                                    {hiddenLayers.includes("hero") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                {isHeroGroupOpen && (
                                  <>
                                    {/* Headline */}
                                    <div
                                      className={`adv-tree-item adv-tree-indent-2 ${selectedLayer === "headline" ? "active" : ""}`}
                                      onClick={() => setSelectedLayer("headline")}
                                    >
                                      <div className="adv-tree-item-left">
                                        <span style={{ color: "#38bdf8" }}>•</span>
                                        <span>Headline</span>
                                      </div>
                                      <span className="adv-tree-badge">H1</span>
                                    </div>

                                    {/* D1 Display 1 */}
                                    <div
                                      className={`adv-tree-item adv-tree-indent-2 ${selectedLayer === "display-1" ? "active" : ""}`}
                                      onClick={() => setSelectedLayer("display-1")}
                                    >
                                      <div className="adv-tree-item-left">
                                        <span style={{ color: "#38bdf8" }}>•</span>
                                        <span>D1 Display 1</span>
                                      </div>
                                    </div>

                                    {/* Sh Subheading */}
                                    <div
                                      className={`adv-tree-item adv-tree-indent-2 ${selectedLayer === "subheading" ? "active" : ""}`}
                                      onClick={() => setSelectedLayer("subheading")}
                                    >
                                      <div className="adv-tree-item-left">
                                        <span style={{ color: "#38bdf8" }}>•</span>
                                        <span>Sh Subheading</span>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Other Elements in Homepage */}
                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "client-logo" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("client-logo")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Client Logo</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("client-logo");
                                    }}
                                  >
                                    {hiddenLayers.includes("client-logo") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "about-us" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("about-us")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>About Us</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("about-us");
                                    }}
                                  >
                                    {hiddenLayers.includes("about-us") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "feature" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("feature")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Feature</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("feature");
                                    }}
                                  >
                                    {hiddenLayers.includes("feature") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "pricing" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("pricing")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Pricing</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("pricing");
                                    }}
                                  >
                                    {hiddenLayers.includes("pricing") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "testimonial" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("testimonial")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Testimonial</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("testimonial");
                                    }}
                                  >
                                    {hiddenLayers.includes("testimonial") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "cta" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("cta")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>CTA</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("cta");
                                    }}
                                  >
                                    {hiddenLayers.includes("cta") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`adv-tree-item adv-tree-indent-1 ${selectedLayer === "footer" ? "active" : ""}`}
                                  onClick={() => setSelectedLayer("footer")}
                                >
                                  <div className="adv-tree-item-left">
                                    <span style={{ color: "#a855f7" }}>•</span>
                                    <span>Footer</span>
                                  </div>
                                  <div
                                    className="adv-tree-icons"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLayerVisibility("footer");
                                    }}
                                  >
                                    {hiddenLayers.includes("footer") ? (
                                      <EyeOff size={12} color="#f43f5e" />
                                    ) : (
                                      <Eye size={12} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {leftSidebarTab === "blocks" && (
                        <div className="adv-sidebar-section">
                          <div className="adv-sidebar-heading">
                            <span>BLOCKS LIBRARY</span>
                          </div>
                          {[
                            "Navbar",
                            "Hero Section",
                            "Client Logo",
                            "About Us",
                            "Feature",
                            "Pricing",
                            "Testimonial",
                            "CTA",
                            "Footer",
                          ].map((block) => (
                            <div
                              key={block}
                              className="adv-page-item"
                              onClick={() => handleInsertBlock(block)}
                              style={{ justifyContent: "space-between" }}
                            >
                              <div className="adv-page-item-left">
                                <Blocks size={14} color="#a855f7" />
                                <span>{block}</span>
                              </div>
                              <Plus size={12} color="#7f78a0" />
                            </div>
                          ))}
                        </div>
                      )}

                      {leftSidebarTab === "assets" && (
                        <div className="adv-sidebar-section">
                          <div className="adv-sidebar-heading">
                            <span>MEDIA ASSETS</span>
                          </div>
                          <label
                            className="adv-add-page-btn"
                            style={{
                              cursor: "pointer",
                              border: "1px dashed #3d2b70",
                              justifyContent: "center",
                              marginBottom: 12,
                            }}
                          >
                            <Upload size={14} />
                            <span>Upload Asset</span>
                            <input
                              type="file"
                              style={{ display: "none" }}
                              onChange={handleUploadAsset}
                            />
                          </label>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div
                              style={{
                                height: 60,
                                borderRadius: 6,
                                backgroundImage:
                                  "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80')",
                                backgroundSize: "cover",
                                cursor: "pointer",
                                border: "1px solid #332463",
                              }}
                              title="Mountains Hero"
                              onClick={() => showToast("Applied Mountain Hero background")}
                            />
                            <div
                              style={{
                                height: 60,
                                borderRadius: 6,
                                backgroundImage:
                                  "url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=300&q=80')",
                                backgroundSize: "cover",
                                cursor: "pointer",
                                border: "1px solid #332463",
                              }}
                              title="Hiking Pack"
                              onClick={() => showToast("Applied Hiking Pack asset")}
                            />
                          </div>
                        </div>
                      )}
                    </aside>
                  )}

                  {/* CENTER CANVAS WORKSPACE */}
                  <main className="adv-canvas-workspace">
                    {isPreviewModeOnly && (
                      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 999 }}>
                        <button
                          className="adv-save-tokens-btn"
                          style={{ padding: "6px 14px", height: "auto" }}
                          onClick={() => setIsPreviewModeOnly(false)}
                        >
                          Exit Preview
                        </button>
                      </div>
                    )}

                    <div
                      className={`adv-website-frame ${
                        accessibility.highlightLinks ? "adv-acc-highlight-links" : ""
                      } ${accessibility.reduceMotion ? "adv-acc-reduce-motion" : ""} ${
                        accessibility.hideImages ? "adv-acc-hide-images" : ""
                      } ${!accessibility.darkMode ? "adv-acc-light-mode" : ""}`}
                      style={{
                        maxWidth:
                          deviceMode === "mobile"
                            ? "390px"
                            : deviceMode === "tablet"
                            ? "768px"
                            : "1040px",
                        transform: `scale(${parseFloat(zoomLevel) / 100})`,
                        transformOrigin: "top center",
                        filter: accessibility.highContrast ? "contrast(150%)" : undefined,
                        fontFamily: accessibility.dyslexiaFont
                          ? "Comic Sans MS, OpenDyslexic, sans-serif"
                          : selectedFont,
                        cursor: accessibility.largeCursor ? "crosshair" : undefined,
                        position: "relative",
                      }}
                    >
                      {/* 0. Reading Guide Overlay */}
                      {accessibility.readingGuide && (
                        <div className="adv-reading-guide-line" style={{ top: 210 }} />
                      )}

                      {/* 1. Announcement Bar */}
                      {announcementVisible && !hiddenLayers.includes("announcement") && (
                        <div className="adv-announcement-strip">
                          <div className="adv-announcement-content">
                            <span style={{ fontSize: 9, color: "#fdf2f8" }}>●</span>
                            <span>{announcementText}</span>
                            <span className="adv-promo-badge">{promoCode}</span>
                          </div>
                          <button
                            type="button"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                            }}
                            onClick={() => setAnnouncementVisible(false)}
                            title="Dismiss"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* 2. Navbar */}
                      {!hiddenLayers.includes("navbar") && (
                        <nav
                          className="adv-navbar"
                          style={{
                            backgroundColor: accessibility.darkMode ? "#ffffff" : "#f8fafc",
                          }}
                          onClick={() => setSelectedLayer("navbar")}
                        >
                          <div className="adv-brand-logo">
                            <span style={{ color: "#7c3aed", fontSize: 18 }}>▲</span>
                            <span>FIKRISHOP</span>
                          </div>

                          <div className="adv-nav-links">
                            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                              Shop <ChevronDown size={12} />
                            </span>
                            <span>Rentals</span>
                            <span>Collections</span>
                            <span>How It Works</span>
                          </div>

                          <div className="adv-nav-icons">
                            <Search size={16} />
                            <User size={16} />
                            <div style={{ position: "relative" }}>
                              <ShoppingBag size={16} />
                              <span
                                style={{
                                  position: "absolute",
                                  top: -6,
                                  right: -8,
                                  backgroundColor: "#ec4899",
                                  color: "#ffffff",
                                  fontSize: 9,
                                  fontWeight: 700,
                                  borderRadius: "50%",
                                  width: 14,
                                  height: 14,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                0
                              </span>
                            </div>
                          </div>
                        </nav>
                      )}

                      {/* 3. Hero Section */}
                      {!hiddenLayers.includes("hero") && (
                        <section
                          className="adv-hero-section"
                          style={{
                            backgroundImage: accessibility.hideImages
                              ? "none"
                              : "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80')",
                          }}
                          onClick={() => setSelectedLayer("hero")}
                        >
                          <div className="adv-hero-overlay" />

                          <div className="adv-hero-content">
                            <div className="adv-hero-eyebrow">{heroEyebrow}</div>

                            {/* Selected Heading Box matching PDF */}
                            <div
                              className="adv-selected-wrap"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLayer("headline");
                              }}
                            >
                              {selectedLayer === "headline" && (
                                <div className="adv-h1-badge">H1 HEADING</div>
                              )}
                              {isEditingHeadline ? (
                                <input
                                  type="text"
                                  value={heroHeadline}
                                  autoFocus
                                  onChange={(e) => setHeroHeadline(e.target.value)}
                                  onBlur={() => setIsEditingHeadline(false)}
                                  onKeyDown={(e) => e.key === "Enter" && setIsEditingHeadline(false)}
                                  style={{
                                    background: "#1c1540",
                                    color: "#ffffff",
                                    border: "1px solid #7c3aed",
                                    borderRadius: 4,
                                    padding: "4px 8px",
                                    fontSize: 36,
                                    fontWeight: 900,
                                    width: "100%",
                                  }}
                                />
                              ) : (
                                <h1
                                  className="adv-hero-h1"
                                  onDoubleClick={() => setIsEditingHeadline(true)}
                                  title="Double click to edit headline"
                                >
                                  Gear up for <br />
                                  <span className="adv-hero-gradient-text">bigger</span> adventures.
                                </h1>
                              )}
                            </div>

                            <p className="adv-hero-desc">{heroDesc}</p>

                            <div className="adv-hero-buttons">
                              <button
                                className="adv-hero-shop-btn"
                                onClick={() => showToast("Navigating to shop...")}
                              >
                                <span>Shop All Gear</span>
                                <span>→</span>
                              </button>
                              <button
                                className="adv-hero-video-btn"
                                onClick={() => setIsVideoModalOpen(true)}
                              >
                                <Play size={13} fill="#ffffff" />
                                <span>Watch Video</span>
                              </button>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* 4. Benefits Row */}
                      {!hiddenLayers.includes("feature") && (
                        <div className="adv-benefits-row">
                          <div className="adv-benefit-item">
                            <div className="adv-benefit-icon">
                              <Truck size={18} color="#7c3aed" />
                            </div>
                            <div>
                              <div className="adv-benefit-title">Free Delivery</div>
                              <div className="adv-benefit-sub">On orders over $50</div>
                            </div>
                          </div>
                          <div className="adv-benefit-item">
                            <div className="adv-benefit-icon">
                              <ShieldCheck size={18} color="#7c3aed" />
                            </div>
                            <div>
                              <div className="adv-benefit-title">Trusted Quality</div>
                              <div className="adv-benefit-sub">From top brands</div>
                            </div>
                          </div>
                          <div className="adv-benefit-item">
                            <div className="adv-benefit-icon">
                              <Leaf size={18} color="#7c3aed" />
                            </div>
                            <div>
                              <div className="adv-benefit-title">Sustainable</div>
                              <div className="adv-benefit-sub">A cleaner tomorrow</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 5. Search Adventure Booking Section */}
                      <div className="adv-search-section">
                        <div className="adv-search-header">
                          <div>
                            <div className="adv-search-title">
                              <Search size={16} color="#7c3aed" />
                              <span>Find your next adventure</span>
                            </div>
                          </div>
                          <div className="adv-search-desc">
                            Rent high-quality gear from trusted brands.
                          </div>
                        </div>

                        <form onSubmit={handleSearchAdventure} className="adv-search-form">
                          <div className="adv-field-group">
                            <label className="adv-field-label">Gear type</label>
                            <select
                              className="adv-field-input"
                              value={gearType}
                              onChange={(e) => setGearType(e.target.value)}
                            >
                              <option value="Snowboard">Snowboard</option>
                              <option value="Mountain Bike">Mountain Bike</option>
                              <option value="Camping Tent">Camping Tent</option>
                              <option value="Climbing Gear">Climbing Gear</option>
                            </select>
                          </div>

                          <div className="adv-field-group">
                            <label className="adv-field-label">Delivery date</label>
                            <input
                              type="date"
                              className="adv-field-input"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                            />
                          </div>

                          <div className="adv-field-group">
                            <label className="adv-field-label">Return date</label>
                            <input
                              type="date"
                              className="adv-field-input"
                              value={returnDate}
                              onChange={(e) => setReturnDate(e.target.value)}
                            />
                          </div>

                          <div className="adv-field-group">
                            <label className="adv-field-label">Location</label>
                            <input
                              type="text"
                              className="adv-field-input"
                              value={searchLocation}
                              onChange={(e) => setSearchLocation(e.target.value)}
                            />
                          </div>

                          <button type="submit" className="adv-search-submit-btn">
                            Search Gear
                          </button>
                        </form>
                        {searchError && (
                          <div
                            style={{
                              color: "#ef4444",
                              fontSize: 11,
                              marginTop: 6,
                              fontWeight: 600,
                            }}
                          >
                            {searchError}
                          </div>
                        )}
                      </div>

                      {/* 6. Exclusive Summer Offer Banner */}
                      {!hiddenLayers.includes("cta") && (
                        <div className="adv-exclusive-offer">
                          <div className="adv-offer-left">
                            <div className="adv-offer-eyebrow">EXCLUSIVE SUMMER OFFER</div>
                            <div className="adv-offer-pct">15% OFF</div>
                            <div className="adv-offer-desc">
                              Premium gear for your next adventure.
                            </div>
                            <button
                              className="adv-offer-cta"
                              onClick={() => showToast("Opening Summer Collection...")}
                            >
                              Shop the Collection →
                            </button>
                          </div>

                          <div className="adv-offer-right">
                            <div className="adv-offer-icons">
                              <div className="adv-offer-icon-box" title="Tent">
                                <Home size={22} />
                              </div>
                              <div className="adv-offer-icon-box" title="Camp Equipment">
                                <Box size={22} />
                              </div>
                            </div>

                            <div className="adv-circular-badge">
                              <span>BUILT</span>
                              <span>FOR A</span>
                              <span>BRIGHTER</span>
                              <span>TOMORROW</span>
                              <Sparkles size={10} style={{ marginTop: 2 }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </main>

                  {/* RIGHT PROPERTIES INSPECTOR (320px) */}
                  {!isPreviewModeOnly && (
                    <aside className="adv-right-inspector">
                      <div className="adv-inspector-tabs">
                        <button
                          className={`adv-inspector-tab ${inspectorTab === "style" ? "active" : ""}`}
                          onClick={() => setInspectorTab("style")}
                        >
                          Style
                        </button>
                        <button
                          className={`adv-inspector-tab ${inspectorTab === "animation" ? "active" : ""}`}
                          onClick={() => setInspectorTab("animation")}
                        >
                          Animation
                        </button>
                        <button
                          className={`adv-inspector-tab ${inspectorTab === "advanced" ? "active" : ""}`}
                          onClick={() => setInspectorTab("advanced")}
                        >
                          Advanced
                        </button>
                      </div>

                      <div className="adv-inspector-content">
                        {inspectorTab === "advanced" && (
                          <>
                            {/* Section 1: Accessibility */}
                            <div
                              className="adv-acc-header"
                              onClick={() => setIsAccessibilityOpen((prev) => !prev)}
                            >
                              <div className="adv-acc-title">
                                <span>{isAccessibilityOpen ? "−" : "+"}</span>
                                <span>Accessibility</span>
                              </div>
                              <div
                                className="adv-global-panel-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGlobalModalOpen(true);
                                }}
                              >
                                <Globe size={12} />
                                <span>Global Panel</span>
                              </div>
                            </div>

                            {isAccessibilityOpen && (
                              <div className="adv-accessibility-grid">
                                <div
                                  className={`adv-acc-tile ${accessibility.highContrast ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("highContrast")}
                                >
                                  <Contrast size={14} />
                                  <span>High Contrast</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.darkMode ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("darkMode")}
                                >
                                  <Moon size={14} />
                                  <span>Dark Mode</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.dyslexiaFont ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("dyslexiaFont")}
                                >
                                  <span style={{ fontWeight: 800, fontSize: 11 }}>Aa</span>
                                  <span>Dyslexia Font</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.largeCursor ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("largeCursor")}
                                >
                                  <MousePointer size={14} />
                                  <span>Large Cursor</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.highlightLinks ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("highlightLinks")}
                                >
                                  <Link2 size={14} />
                                  <span>Highlight Links</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.reduceMotion ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("reduceMotion")}
                                >
                                  <Sliders size={14} />
                                  <span>Reduce Motion</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.readingGuide ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("readingGuide")}
                                >
                                  <FileText size={14} />
                                  <span>Reading Guide</span>
                                </div>
                                <div
                                  className={`adv-acc-tile ${accessibility.hideImages ? "active" : ""}`}
                                  onClick={() => toggleAccessibility("hideImages")}
                                >
                                  <EyeOff size={14} />
                                  <span>Hide Images</span>
                                </div>
                              </div>
                            )}

                            <div style={{ height: 1, backgroundColor: "#1c1737", margin: "14px 0" }} />

                            {/* Section 2: Design Tokens */}
                            <div className="adv-tokens-title">
                              <Palette size={14} color="#a855f7" />
                              <span>Design Tokens</span>
                            </div>

                            <div className="adv-tokens-subtabs">
                              {(["colors", "typography", "spacing", "shadows", "custom"] as const).map(
                                (cat) => (
                                  <button
                                    key={cat}
                                    className={`adv-token-subtab ${
                                      tokenCategory === cat ? "active" : ""
                                    }`}
                                    onClick={() => setTokenCategory(cat)}
                                  >
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                  </button>
                                )
                              )}
                            </div>

                            <div className="adv-tokens-toolbar">
                              <select
                                className="adv-theme-select"
                                value={tokenTheme}
                                onChange={(e) => setTokenTheme(e.target.value)}
                              >
                                <option value="Theme: Dark">Theme: Dark</option>
                                <option value="Theme: Light">Theme: Light</option>
                              </select>

                              <div className="adv-tokens-tool-icons">
                                <button
                                  className="adv-tool-icon-btn"
                                  title="Export Tokens"
                                  onClick={handleExportTokens}
                                >
                                  <Download size={12} />
                                </button>
                                <label
                                  className="adv-tool-icon-btn"
                                  title="Import Tokens"
                                  style={{
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Upload size={12} />
                                  <input
                                    type="file"
                                    accept=".json"
                                    ref={tokenFileInputRef}
                                    style={{ display: "none" }}
                                    onChange={handleImportTokens}
                                  />
                                </label>
                                <button
                                  className="adv-add-token-btn"
                                  onClick={() => setAddTokenModalOpen(true)}
                                >
                                  <Plus size={11} />
                                  <span>Add Token</span>
                                </button>
                              </div>
                            </div>

                            {/* Colors Swatches (Primary Palette 10 shades) */}
                            <div className="adv-swatches-section">
                              <div className="adv-swatches-title">
                                <span style={{ color: "#ffffff", fontWeight: 700 }}>
                                  Primary Palette
                                </span>
                                <span style={{ fontSize: 10 }}>10 shades</span>
                              </div>

                              <div className="adv-swatches-row">
                                {Object.entries(paletteShades).map(([shade, hex]) => (
                                  <div
                                    key={shade}
                                    className="adv-swatch"
                                    style={{
                                      backgroundColor: hex,
                                      color: parseInt(shade) < 400 ? "#0f172a" : "#ffffff",
                                    }}
                                    onClick={() => {
                                      const newHex = window.prompt(
                                        `Edit hex for shade ${shade}:`,
                                        hex
                                      );
                                      if (newHex) {
                                        setPaletteShades((prev) => ({
                                          ...prev,
                                          [shade]: newHex,
                                        }));
                                        showToast(`Updated shade ${shade} to ${newHex}`);
                                      }
                                    }}
                                    title={`${shade}: ${hex}`}
                                  >
                                    <span>{shade}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="adv-swatches-title" style={{ marginTop: 12 }}>
                                <span style={{ color: "#ffffff", fontWeight: 700 }}>Semantic</span>
                              </div>
                              <div className="adv-semantic-row">
                                <div
                                  className="adv-semantic-pill"
                                  style={{ backgroundColor: "#10b981" }}
                                >
                                  Success
                                </div>
                                <div
                                  className="adv-semantic-pill"
                                  style={{ backgroundColor: "#f59e0b" }}
                                >
                                  Warning
                                </div>
                                <div
                                  className="adv-semantic-pill"
                                  style={{ backgroundColor: "#ef4444" }}
                                >
                                  Error
                                </div>
                                <div
                                  className="adv-semantic-pill"
                                  style={{ backgroundColor: "#3b82f6" }}
                                >
                                  Info
                                </div>
                              </div>
                            </div>

                            {/* Typography Tokens */}
                            <div className="adv-swatches-title" style={{ marginTop: 14 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: "#ffffff",
                                  fontWeight: 700,
                                }}
                              >
                                <Type size={13} color="#a855f7" />
                                <span>Typography</span>
                              </div>
                              <span
                                style={{ color: "#a855f7", fontSize: 10.5, cursor: "pointer" }}
                                onClick={() => showToast("Font manager open")}
                              >
                                Manage Fonts
                              </span>
                            </div>

                            <select
                              className="adv-field-input"
                              style={{ width: "100%", height: 32, fontSize: 12, marginTop: 6 }}
                              value={selectedFont}
                              onChange={(e) => setSelectedFont(e.target.value)}
                            >
                              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                              <option value="Inter">Inter</option>
                              <option value="Roboto">Roboto</option>
                              <option value="Outfit">Outfit</option>
                            </select>

                            <div className="adv-typo-scale-grid">
                              {[
                                { name: "H1", val: "56/120" },
                                { name: "H2", val: "40/120" },
                                { name: "H3", val: "32/120" },
                                { name: "H4", val: "24/120" },
                                { name: "Body", val: "16/28" },
                                { name: "Caption", val: "12/20" },
                              ].map((token) => (
                                <div
                                  key={token.name}
                                  className={`adv-typo-scale-chip ${
                                    activeTypoChip === token.name ? "active" : ""
                                  }`}
                                  onClick={() => setActiveTypoChip(token.name)}
                                >
                                  <div className="adv-typo-token-name">{token.name}</div>
                                  <div className="adv-typo-token-val">{token.val}</div>
                                </div>
                              ))}
                            </div>

                            {/* Spacing Tokens */}
                            <div className="adv-swatches-title" style={{ marginTop: 14 }}>
                              <span style={{ color: "#ffffff", fontWeight: 700 }}>Spacing</span>
                            </div>
                            <div className="adv-spacing-row">
                              {["4", "8", "12", "16", "24", "32", "48", "64"].map((sp) => (
                                <div
                                  key={sp}
                                  className="adv-spacing-chip"
                                  onClick={() => showToast(`Spacing: ${sp}px`)}
                                >
                                  {sp}
                                </div>
                              ))}
                            </div>

                            {/* Layout Controls */}
                            <div className="adv-layout-grid">
                              <div className="adv-layout-cell">
                                <span className="adv-layout-label">Type</span>
                                <span className="adv-layout-val">{layoutStretch}</span>
                              </div>
                              <div className="adv-layout-cell">
                                <span className="adv-layout-label">Width</span>
                                <span className="adv-layout-val">{layoutWidth}</span>
                              </div>
                              <div className="adv-layout-cell">
                                <span className="adv-layout-label">Margin</span>
                                <input
                                  className="adv-layout-val"
                                  value={layoutMargin}
                                  onChange={(e) => setLayoutMargin(e.target.value)}
                                />
                              </div>
                              <div className="adv-layout-cell">
                                <span className="adv-layout-label">Gutter</span>
                                <input
                                  className="adv-layout-val"
                                  value={layoutGutter}
                                  onChange={(e) => setLayoutGutter(e.target.value)}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {inspectorTab === "animation" && (
                          <div style={{ color: "#beb8db", fontSize: 12 }}>
                            <div className="adv-sidebar-heading">ANIMATION CONTROLS</div>
                            <div className="adv-field-group" style={{ marginBottom: 12 }}>
                              <label className="adv-field-label">Type</label>
                              <select className="adv-field-input" defaultValue="Fade In">
                                <option value="Fade In">Fade In</option>
                                <option value="Slide Up">Slide Up</option>
                                <option value="Scale Up">Scale Up</option>
                              </select>
                            </div>
                            <div className="adv-field-group" style={{ marginBottom: 12 }}>
                              <label className="adv-field-label">Duration</label>
                              <input className="adv-field-input" defaultValue="500ms" />
                            </div>
                            <button
                              className="adv-apply-btn"
                              style={{ width: "100%" }}
                              onClick={() => showToast("Animation preview played")}
                            >
                              Preview Animation
                            </button>
                          </div>
                        )}

                        {inspectorTab === "style" && (
                          <div style={{ color: "#beb8db", fontSize: 12 }}>
                            <div className="adv-sidebar-heading">STYLE & ELEMENT PROPERTIES</div>
                            <div className="adv-field-group" style={{ marginBottom: 12 }}>
                              <label className="adv-field-label">Element ID</label>
                              <input
                                className="adv-field-input"
                                defaultValue="fikri-hero-headline"
                                readOnly
                              />
                            </div>
                            <div className="adv-field-group" style={{ marginBottom: 12 }}>
                              <label className="adv-field-label">CSS Class</label>
                              <input className="adv-field-input" defaultValue="adv-hero-h1" readOnly />
                            </div>
                            <div className="adv-sidebar-heading" style={{ marginTop: 14 }}>
                              RESPONSIVE VISIBILITY
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 14,
                                fontSize: 11,
                                color: "#cbd5e1",
                              }}
                            >
                              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input type="checkbox" defaultChecked /> Desktop
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input type="checkbox" defaultChecked /> Tablet
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input type="checkbox" defaultChecked /> Mobile
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Inspector Bottom Actions */}
                      <div className="adv-inspector-footer">
                        <button
                          type="button"
                          className="adv-apply-btn"
                          onClick={handleApplyTokens}
                          disabled={isApplyingTokens}
                        >
                          {isApplyingTokens ? "Applying..." : "Apply to Website"}
                        </button>

                        <button
                          type="button"
                          className="adv-save-tokens-btn"
                          onClick={handleSaveTokens}
                          disabled={isSavingTokens}
                        >
                          {isSavingTokens ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          <span>Save Tokens</span>
                        </button>
                      </div>
                    </aside>
                  )}
                </div>
              )}
        </main>
      </div>

      {/* ADD TOKEN MODAL */}
      {addTokenModalOpen && (
        <div className="ws-modal-overlay">
          <div className="ws-modal-card" style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff", fontWeight: 700 }}>Add Design Token</h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#8c85ae", cursor: "pointer" }}
                onClick={() => setAddTokenModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateToken}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "#9c95be", marginBottom: 4 }}>Token Name</label>
                <input
                  type="text"
                  className="adv-field-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. brand-neon-glow"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, color: "#9c95be", marginBottom: 4 }}>Category</label>
                <select
                  className="adv-field-input"
                  style={{ width: "100%" }}
                  value={newTokenCategory}
                  onChange={(e) => setNewTokenCategory(e.target.value)}
                >
                  <option value="colors">Colors</option>
                  <option value="typography">Typography</option>
                  <option value="spacing">Spacing</option>
                  <option value="shadows">Shadows</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, color: "#9c95be", marginBottom: 4 }}>Token Value</label>
                <input
                  type="text"
                  className="adv-field-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. #c084fc or 28px"
                  value={newTokenVal}
                  onChange={(e) => setNewTokenVal(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ws-sec-btn-outline"
                  onClick={() => setAddTokenModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="adv-save-tokens-btn" style={{ padding: "0 18px" }}>
                  Save Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WATCH VIDEO TOUR MODAL */}
      {isVideoModalOpen && (
        <div className="ws-modal-overlay">
          <div className="ws-modal-card" style={{ maxWidth: 560, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff", fontWeight: 700 }}>FIKRISHOP: Summer Adventure Preview</h3>
                <span style={{ fontSize: 11, color: "#8c85ae" }}>4K Scenic Mountain Expeditions (04:35)</span>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#8c85ae", cursor: "pointer" }}
                onClick={() => setIsVideoModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                width: "100%",
                height: 280,
                borderRadius: 10,
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                border: "1px solid #3d2b70",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "rgba(124, 58, 237, 0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: "0 0 25px rgba(124, 58, 237, 0.6)",
                }}
                onClick={() => showToast("Playing FIKRISHOP Expedition Tour...")}
              >
                <Play size={24} fill="#ffffff" />
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 14,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#e2e8f0",
                }}
              >
                Live HD Stream Ready
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button
                type="button"
                className="ws-sec-btn-outline"
                onClick={() => setIsVideoModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {publishModalOpen && (
        <div className="ws-modal-overlay">
          <div className="ws-modal-card" style={{ maxWidth: 440, textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Check size={24} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>
              Ready to Publish Your Site?
            </h3>
            <p style={{ fontSize: 13, color: "#8b85ad", lineHeight: 1.5, margin: "0 0 20px" }}>
              Your generated layout and responsive outdoor store will be deployed
              to production CDN with automated SSL certificates.
            </p>

            <div
              style={{
                background: "#0c0a18",
                border: "1px solid #231c46",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 12.5, color: "#a855f7" }}>
                https://fikrishop.forgestudio.site
              </span>
              <button
                className="ai-editor-pill-btn"
                onClick={() => {
                  navigator.clipboard.writeText("https://fikrishop.forgestudio.site");
                  showToast("Live URL copied!");
                }}
              >
                Copy
              </button>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="ws-sec-btn-outline"
                style={{ flex: 1 }}
                onClick={() => setPublishModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="ai-publish-btn"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  setPublishModalOpen(false);
                  showToast("🎉 Site published live successfully!");
                }}
              >
                Deploy Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            backgroundColor: "#7c3aed",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ✓ {toastMsg}
        </div>
      )}
    </div>
  );
}
