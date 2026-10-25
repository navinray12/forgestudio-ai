/**
 * ReviewsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles, ReviewItem } from "../../../types";

export const ReviewsWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
  onUpdateElement,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
  onUpdateElement?: (updatedEl: EditorElement) => void;
}) => {
  const [localItems, setLocalItems] = useState<ReviewItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReviewerName, setNewReviewerName] = useState("");
  const [newReviewerTitle, setNewReviewerTitle] = useState("");
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [newVerified, setNewVerified] = useState(true);

  const [avatarInputType, setAvatarInputType] = useState<"url" | "file">("url");

  useEffect(() => {
    setLocalItems(el.reviewItems && el.reviewItems.length > 0 ? el.reviewItems : []);
  }, [el.reviewItems]);

  const reviews = localItems;
  const isGrid = el.reviewLayout !== "list";
  const columns = el.reviewColumns || 3;
  const alignment = el.reviewAlignment || "left";
  const starColor = el.reviewStarColor || "#f59e0b";
  const cardBg = el.reviewCardBg || "#ffffff";
  const borderColor = el.reviewBorderColor || "#e2e8f0";
  const showAvatar = el.reviewShowAvatar !== false;
  const showVerified = el.reviewShowVerified !== false;
  const allowSubmission = el.reviewAllowSubmission !== false;
  const buttonText = el.reviewSubmissionButtonText || "+ Write a Review";

  const textAlignClass =
    alignment === "center" ? "text-center items-center" : alignment === "right" ? "text-right items-end" : "text-left items-start";

  const gridColsStyle = isGrid
    ? {
        gridTemplateColumns:
          columns === 1
            ? "repeat(1, minmax(0, 1fr))"
            : columns === 2
            ? "repeat(auto-fit, minmax(280px, 1fr))"
            : columns === 4
            ? "repeat(auto-fit, minmax(220px, 1fr))"
            : "repeat(auto-fit, minmax(260px, 1fr))",
      }
    : { gridTemplateColumns: "1fr" };

  const handleManualAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewerName.trim() || !newReviewText.trim()) return;

    const newItem: ReviewItem = {
      id: "rev-" + Date.now(),
      reviewerName: newReviewerName.trim(),
      reviewerTitle: newReviewerTitle.trim() || "Verified Customer",
      reviewText: newReviewText.trim(),
      rating: newRating,
      avatarUrl: newAvatarUrl.trim() || undefined,
      verified: newVerified,
    };

    const updated = [...reviews, newItem];
    setLocalItems(updated);
    if (onUpdateElement) {
      onUpdateElement({ ...el, reviewItems: updated });
    }

    setNewReviewerName("");
    setNewReviewerTitle("");
    setNewReviewText("");
    setNewRating(5);
    setNewAvatarUrl("");
    setShowAddModal(false);
  };

  return (
    <div
      className="w-full transition-all"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      {/* Top Header Action Row (Write a Review button) */}
      {allowSubmission && (
        <div className={`mb-4 flex ${alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start"}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddModal(!showAddModal);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-95 cursor-pointer"
          >
            <span>★</span>
            <span>{showAddModal ? "Cancel Manual Review" : buttonText}</span>
          </button>
        </div>
      )}

      {/* Manual Review Entry Form / Modal Card */}
      {showAddModal && (
        <form
          onSubmit={handleManualAddReview}
          onClick={(e) => e.stopPropagation()}
          className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/50 p-5 shadow-sm space-y-4 max-w-lg mx-auto transition-all"
        >
          <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>✍️</span> Submit Customer Review Manually
            </h4>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Rating Selection */}
          <div>
            <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
              Rating (1 to 5 Stars)
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewRating(star)}
                  className="p-0.5 transition hover:scale-125 focus:outline-none cursor-pointer"
                >
                  <svg
                    className="h-6 w-6"
                    fill={star <= newRating ? starColor : "#cbd5e1"}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-amber-800">{newRating} / 5 Stars</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 mb-1">Reviewer Name *</label>
              <input
                type="text"
                required
                value={newReviewerName}
                onChange={(e) => setNewReviewerName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 mb-1">Title / Role</label>
              <input
                type="text"
                value={newReviewerTitle}
                onChange={(e) => setNewReviewerTitle(e.target.value)}
                placeholder="e.g. Verified Buyer"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-700 mb-1">Review Text *</label>
            <textarea
              rows={3}
              required
              value={newReviewText}
              onChange={(e) => setNewReviewText(e.target.value)}
              placeholder="Share your experience..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-normal text-slate-800 outline-none focus:border-amber-500"
            />
          </div>

          {/* Avatar Image Selection (1 URL given, 2 Upload File from computer/media) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-semibold text-slate-700">Avatar Image (Optional)</label>
              <div className="flex items-center gap-1 bg-amber-100/70 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setAvatarInputType("url")}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded transition cursor-pointer ${
                    avatarInputType === "url" ? "bg-white text-amber-900 shadow-2xs" : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  1. Image URL
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarInputType("file")}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded transition cursor-pointer ${
                    avatarInputType === "file" ? "bg-white text-amber-900 shadow-2xs" : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  2. 📁 Upload File
                </button>
              </div>
            </div>

            {avatarInputType === "url" ? (
              <input
                type="text"
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
              />
            ) : (
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white p-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100/50 cursor-pointer transition">
                  <span>📁</span>
                  <span>{newAvatarUrl ? "Change Uploaded Image" : "Choose Image File from Computer / Media"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === "string") {
                            setNewAvatarUrl(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                {newAvatarUrl && (
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-amber-300 bg-slate-100">
                    <img src={newAvatarUrl} alt="Avatar Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newVerified}
                onChange={(e) => setNewVerified(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Mark as Verified Reviewer</span>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition cursor-pointer"
            >
              Submit Review
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
          No customer reviews configured. Click "{buttonText}" above or use the inspector panel to add review items.
        </div>
      ) : (
        <div className="grid gap-4" style={gridColsStyle}>
          {reviews.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition hover:shadow-md ${textAlignClass}`}
              style={{
                backgroundColor: cardBg,
                borderColor: borderColor,
              }}
            >
              <div className={`flex flex-col ${textAlignClass} w-full`}>
                {/* Rating Stars */}
                <div
                  className={`flex items-center gap-1 mb-3 ${
                    alignment === "center" ? "justify-center" : alignment === "right" ? "justify-end" : "justify-start"
                  }`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className="h-4 w-4"
                      fill={star <= (item.rating || 5) ? starColor : "#cbd5e1"}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal mb-4 italic">
                  "{item.reviewText}"
                </p>
              </div>

              {/* Reviewer Details */}
              <div
                className={`flex items-center gap-3 pt-3 border-t border-slate-100 w-full ${
                  alignment === "center"
                    ? "justify-center"
                    : alignment === "right"
                    ? "justify-end flex-row-reverse"
                    : "justify-start"
                }`}
              >
                {showAvatar && (
                  <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                    {item.avatarUrl ? (
                      <img
                        src={item.avatarUrl}
                        alt={item.reviewerName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xs font-bold text-slate-600">
                        {item.reviewerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div className={`flex flex-col ${textAlignClass}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{item.reviewerName}</span>
                    {showVerified && (item.verified ?? true) && (
                      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full" title="Verified Customer Review">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  {item.reviewerTitle && (
                    <span className="text-[11px] font-medium text-slate-500">{item.reviewerTitle}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
