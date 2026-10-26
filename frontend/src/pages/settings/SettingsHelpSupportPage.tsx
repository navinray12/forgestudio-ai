import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  BookOpen,
  Layout,
  Layers,
  Sparkles,
  CreditCard,
  Wrench,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Headphones,
  Mail,
  Clock,
  PlayCircle,
  FileText,
  Users,
  Lightbulb,
  Send,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import "./Settings.css";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    question: "How do I create my first website?",
    answer:
      "Click 'Add' or 'Templates' on the left rail to choose a starter template, or start from a blank canvas. You can drag and drop elements, customize layout styles, and publish instantly.",
  },
  {
    id: "faq-2",
    question: "Can I use my own domain?",
    answer:
      "Yes! On Pro and Enterprise plans, you can connect unlimited custom domains with automated SSL certificate provisioning and zero-downtime DNS routing.",
  },
  {
    id: "faq-3",
    question: "How do I publish my website?",
    answer:
      "Click the 'Publish' button in the top right corner of the editor. Your site will immediately be live on a secure HTTPS subdomain or your custom configured domain.",
  },
  {
    id: "faq-4",
    question: "How to install and use plugins?",
    answer:
      "Navigate to the Plugin tab in the left rail or Community page to browse available integrations. Click 'Install' to connect analytics, e-commerce, forms, or dynamic data connectors.",
  },
  {
    id: "faq-5",
    question: "How do I upgrade my plan?",
    answer:
      "Click the 'Upgrade →' button in the top header or visit the Subscription page to choose between Starter, Pro, and Enterprise tiers with flexible monthly and annual billing.",
  },
  {
    id: "faq-6",
    question: "What payment methods are available?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and UPI / net-banking for supported regions.",
  },
  {
    id: "faq-7",
    question: "I'm facing a technical issue. What should I do?",
    answer:
      "Check our Troubleshooting guides and Community forum, or click 'Send a message' on the right sidebar to chat directly with our 24/7 technical support engineers.",
  },
];

const POPULAR_TOPICS = [
  "Getting started",
  "Build a website",
  "Templates",
  "Domains",
  "Billing",
  "Integrations",
];

const TOPIC_CARDS = [
  {
    id: "getting-started",
    title: "Getting Started",
    desc: "Learn the basics and set up your workspace.",
    icon: BookOpen,
    bg: "rgba(168, 85, 247, 0.12)",
    color: "#c084fc",
  },
  {
    id: "pages-templates",
    title: "Pages & Templates",
    desc: "Create, edit and manage your pages.",
    icon: Layout,
    bg: "rgba(59, 130, 246, 0.12)",
    color: "#60a5fa",
  },
  {
    id: "elements-blocks",
    title: "Elements & Blocks",
    desc: "Use and customize elements in your designs.",
    icon: Layers,
    bg: "rgba(99, 102, 241, 0.12)",
    color: "#818cf8",
  },
  {
    id: "plugins-integrations",
    title: "Plugins & Integrations",
    desc: "Connect with your favorite tools.",
    icon: Sparkles,
    bg: "rgba(20, 184, 166, 0.12)",
    color: "#2dd4bf",
  },
  {
    id: "account-billing",
    title: "Account & Billing",
    desc: "Manage your plan, payments and invoices.",
    icon: CreditCard,
    bg: "rgba(236, 72, 153, 0.12)",
    color: "#f472b6",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    desc: "Solve common issues quickly.",
    icon: Wrench,
    bg: "rgba(139, 92, 246, 0.12)",
    color: "#a78bfa",
  },
];

export default function SettingsHelpSupportPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Modals state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDetails, setTicketDetails] = useState("");
  const [sending, setSending] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const toggleFaq = (id: string) => {
    setExpandedFaqId((prev) => (prev === id ? null : id));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      showToast(`Searching help articles for "${searchQuery}"`);
    }
  };

  const handleSelectPill = (pill: string) => {
    setSearchQuery(pill);
    showToast(`Filtered by "${pill}"`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setIsMessageModalOpen(false);
      setMessageText("");
      showToast("Message sent! Our support team will reply shortly.");
    }, 800);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setIsTicketModalOpen(false);
      setTicketSubject("");
      setTicketDetails("");
      showToast("Ticket #4092 created successfully");
    }, 800);
  };

  // Filter FAQs based on search
  const filteredFaqs = searchQuery
    ? FAQS.filter(
        (f) =>
          f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : FAQS;

  return (
    <SettingsLayout activeTab="support">
      <div className="ws-help-layout">
        {/* ================= LEFT MAIN COLUMN ================= */}
        <div className="ws-help-main-col">
          {/* Header */}
          <h1 className="ws-page-title" style={{ fontSize: 28, margin: "0 0 6px" }}>
            How can we help you?
          </h1>
          <p className="ws-page-subtitle" style={{ margin: "0 0 24px", color: "#827e9f" }}>
            Find answers, guides and support to make the most of Web Studio.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="ws-help-search-box">
            <Search size={18} color="#7a759b" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help articles, topics or keywords..."
              className="ws-help-search-input"
            />
            <button type="submit" className="ws-help-search-btn">
              Search
            </button>
          </form>

          {/* Popular Topics */}
          <div className="ws-popular-topics">
            <span className="ws-popular-label">Popular topics:</span>
            {POPULAR_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                className="ws-topic-pill"
                onClick={() => handleSelectPill(topic)}
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Section: Browse Help Topics */}
          <div className="ws-section-header-flex">
            <h2 className="ws-section-header-title">Browse Help Topics</h2>
            <button
              type="button"
              className="ws-view-all-link"
              onClick={() => showToast("Viewing all help categories")}
            >
              <span>View all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 3x2 Grid */}
          <div className="ws-help-topics-grid">
            {TOPIC_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="ws-topic-card"
                  onClick={() => {
                    setSearchQuery(card.title);
                    showToast(`Opened ${card.title} category`);
                  }}
                >
                  <div className="ws-topic-card-left">
                    <div
                      className="ws-topic-icon-box"
                      style={{ backgroundColor: card.bg, color: card.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="ws-topic-title">{card.title}</div>
                      <div className="ws-topic-desc">{card.desc}</div>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#585375" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>

          {/* Section: Frequently Asked Questions */}
          <div className="ws-section-header-flex" style={{ marginTop: 40 }}>
            <h2 className="ws-section-header-title">Frequently Asked Questions</h2>
            <button
              type="button"
              className="ws-view-all-link"
              onClick={() => {
                setSearchQuery("");
                showToast("Viewing all FAQs");
              }}
            >
              <span>View all</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* FAQs Accordions */}
          <div>
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`ws-faq-accordion-item ${isExpanded ? "expanded" : ""}`}
                >
                  <div className="ws-faq-header" onClick={() => toggleFaq(faq.id)}>
                    <div className="ws-faq-question">
                      <HelpCircle size={16} color="#7a759b" />
                      <span>{faq.question}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      color="#7a759b"
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </div>
                  {isExpanded && <div className="ws-faq-answer">{faq.answer}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR ================= */}
        <aside className="ws-help-side-col">
          {/* Section 1: Contact Support */}
          <div className="ws-side-section">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: "#1c1836",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                }}
              >
                <Headphones size={17} />
              </div>
              <div>
                <h3 className="ws-side-card-title" style={{ margin: 0, fontSize: 14 }}>
                  Contact Support
                </h3>
              </div>
            </div>
            <p className="ws-side-card-desc" style={{ margin: "4px 0 14px", fontSize: 12 }}>
              Got a question? Our team is here to help.
            </p>

            <button
              type="button"
              className="ws-side-action-btn"
              onClick={() => setIsMessageModalOpen(true)}
            >
              <Mail size={16} />
              <span>Send a message</span>
            </button>

            <div className="ws-live-status-row">
              <span style={{ fontSize: 12.5, color: "#d1ceeb" }}>Live chat</span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#34d399",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                  }}
                />
                Online now
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#a49fc4",
                  marginBottom: 3,
                }}
              >
                <Clock size={13} color="#7e799c" />
                <span>Support hours</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "#7e799c" }}>
                Mon - Sat, 9:00 AM - 8:00 PM (IST)
              </p>
            </div>
          </div>

          {/* Section 2: Quick Resources */}
          <div className="ws-side-section">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <BookOpen size={16} color="#ffffff" />
              <h3 className="ws-side-card-title" style={{ margin: 0, fontSize: 14 }}>
                Quick Resources
              </h3>
            </div>

            <div>
              {/* Video Tutorials */}
              <div
                className="ws-resource-item"
                onClick={() => showToast("Opening video tutorials library")}
              >
                <div className="ws-resource-left">
                  <div
                    className="ws-resource-icon"
                    style={{ backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}
                  >
                    <PlayCircle size={15} />
                  </div>
                  <div>
                    <div className="ws-resource-title">Video Tutorials</div>
                    <div className="ws-resource-subtitle">Step-by-step guides</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#585375" />
              </div>

              {/* Documentation */}
              <div
                className="ws-resource-item"
                onClick={() => showToast("Opening documentation center")}
              >
                <div className="ws-resource-left">
                  <div
                    className="ws-resource-icon"
                    style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}
                  >
                    <FileText size={15} />
                  </div>
                  <div>
                    <div className="ws-resource-title">Documentation</div>
                    <div className="ws-resource-subtitle">Detailed product docs</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#585375" />
              </div>

              {/* Community Forum */}
              <div
                className="ws-resource-item"
                onClick={() => navigate("/settings/community")}
              >
                <div className="ws-resource-left">
                  <div
                    className="ws-resource-icon"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}
                  >
                    <Users size={15} />
                  </div>
                  <div>
                    <div className="ws-resource-title">Community Forum</div>
                    <div className="ws-resource-subtitle">Get help from other users</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#585375" />
              </div>

              {/* Feature Requests */}
              <div
                className="ws-resource-item"
                onClick={() => showToast("Feature requests roadmap opened")}
              >
                <div className="ws-resource-left">
                  <div
                    className="ws-resource-icon"
                    style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}
                  >
                    <Lightbulb size={15} />
                  </div>
                  <div>
                    <div className="ws-resource-title">Feature Requests</div>
                    <div className="ws-resource-subtitle">Suggest and vote for new features</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#585375" />
              </div>
            </div>
          </div>

          {/* Section 3: Still need help? */}
          <div className="ws-side-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Send size={16} color="#a855f7" />
              <h3 className="ws-side-card-title" style={{ margin: 0, fontSize: 14 }}>
                Still need help?
              </h3>
            </div>
            <p className="ws-side-card-desc" style={{ marginBottom: 16 }}>
              Can't find what you're looking for? Create a support ticket and we'll get back to you.
            </p>

            <button
              type="button"
              className="ws-side-outline-btn"
              onClick={() => setIsTicketModalOpen(true)}
            >
              Create a support ticket
            </button>
          </div>
        </aside>

        {/* SEND MESSAGE MODAL */}
        {isMessageModalOpen && (
          <div className="ws-modal-overlay">
            <div className="ws-modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", margin: 0 }}>
                  Send a Support Message
                </h3>
                <button
                  type="button"
                  className="ws-header-icon-btn"
                  onClick={() => setIsMessageModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendMessage}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12.5, color: "#c3bfde", marginBottom: 6 }}>
                    How can our team help you?
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Describe your question or issue in detail..."
                    style={{
                      width: "100%",
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "10px 14px",
                      fontSize: 13,
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="ws-sec-btn-outline"
                    onClick={() => setIsMessageModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="ws-sec-btn-purple"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {sending && <Loader2 size={14} className="animate-spin" />}
                    <span>{sending ? "Sending..." : "Send Message"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE SUPPORT TICKET MODAL */}
        {isTicketModalOpen && (
          <div className="ws-modal-overlay">
            <div className="ws-modal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", margin: 0 }}>
                  Create a Support Ticket
                </h3>
                <button
                  type="button"
                  className="ws-header-icon-btn"
                  onClick={() => setIsTicketModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12.5, color: "#c3bfde", marginBottom: 6 }}>
                    Ticket Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="e.g., Domain DNS record not propagating"
                    style={{
                      width: "100%",
                      height: 40,
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "0 14px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12.5, color: "#c3bfde", marginBottom: 6 }}>
                    Issue Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={ticketDetails}
                    onChange={(e) => setTicketDetails(e.target.value)}
                    placeholder="Provide any error messages, project links or steps to reproduce..."
                    style={{
                      width: "100%",
                      backgroundColor: "#0d0b1a",
                      border: "1px solid #2d2850",
                      borderRadius: 8,
                      color: "#ffffff",
                      padding: "10px 14px",
                      fontSize: 13,
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="ws-sec-btn-outline"
                    onClick={() => setIsTicketModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="ws-sec-btn-purple"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {sending && <Loader2 size={14} className="animate-spin" />}
                    <span>{sending ? "Creating Ticket..." : "Submit Ticket"}</span>
                  </button>
                </div>
              </form>
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
              backgroundColor: toastMsg.isError ? "#ef4444" : "#10b981",
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
            {toastMsg.isError ? "⚠" : "✓"} {toastMsg.text}
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
