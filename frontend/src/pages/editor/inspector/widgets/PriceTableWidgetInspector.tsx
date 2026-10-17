/**
 * PriceTableWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement, PricingPlan, PricePlanFeature } from "../../types";

// 18. Price Table Inspector
export function PriceTableWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const plans: PricingPlan[] = (el.pricingPlans && el.pricingPlans.length > 0)
    ? el.pricingPlans
    : (el.pricePlans && el.pricePlans.length > 0)
      ? el.pricePlans
      : [
          {
            id: "plan_1",
            name: "Starter",
            price: "19",
            currency: "$",
            period: "/ month",
            description: "Essential tools for personal projects & freelancers.",
            isPopular: false,
            isRecommended: false,
            showBadge: false,
            buttonText: "Start Free Trial",
            buttonUrl: "#",
            buttonAlignment: "full",
            features: [
              { id: "f1", text: "5 Projects included", included: true },
              { id: "f2", text: "10GB SSD Storage", included: true },
              { id: "f3", text: "Basic Analytics", included: true },
              { id: "f4", text: "Custom Domain", included: false },
              { id: "f5", text: "24/7 Dedicated Support", included: false },
            ],
          },
          {
            id: "plan_2",
            name: "Professional",
            price: "49",
            currency: "$",
            period: "/ month",
            description: "Best for growing teams & expanding SaaS startups.",
            isPopular: true,
            isRecommended: true,
            badgeText: "MOST POPULAR",
            showBadge: true,
            buttonText: "Get Pro Now",
            buttonUrl: "#",
            buttonAlignment: "full",
            features: [
              { id: "f1", text: "Unlimited Projects", included: true },
              { id: "f2", text: "100GB SSD Storage", included: true },
              { id: "f3", text: "Advanced Analytics & Reports", included: true },
              { id: "f4", text: "Custom Domain & SSL", included: true },
              { id: "f5", text: "Priority Support", included: true },
            ],
          },
        ];

  const [expandedPlanId, setExpandedPlanId] = React.useState<string | null>(plans[0]?.id || null);

  const draggedPlanIdxRef = React.useRef<number | null>(null);
  const [draggedPlanIdx, setDraggedPlanIdx] = React.useState<number | null>(null);
  const [dragOverPlanIdx, setDragOverPlanIdx] = React.useState<number | null>(null);

  const draggedFeatKeyRef = React.useRef<string | null>(null);
  const [draggedFeatKey, setDraggedFeatKey] = React.useState<string | null>(null);
  const [dragOverFeatKey, setDragOverFeatKey] = React.useState<string | null>(null);

  const handlePlanPointerStart = (startIdx: number, startEvent: React.MouseEvent) => {
    startEvent.stopPropagation();
    startEvent.preventDefault();

    let currentHoverIdx = startIdx;
    setDraggedPlanIdx(startIdx);
    setDragOverPlanIdx(startIdx);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const elUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!elUnder) return;

      const planCard = elUnder.closest("[data-plan-index]");
      if (planCard) {
        const targetIdxAttr = planCard.getAttribute("data-plan-index");
        if (targetIdxAttr !== null) {
          const targetIdx = parseInt(targetIdxAttr, 10);
          if (!isNaN(targetIdx) && targetIdx !== currentHoverIdx) {
            currentHoverIdx = targetIdx;
            setDragOverPlanIdx(targetIdx);
          }
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";

      if (currentHoverIdx !== startIdx && currentHoverIdx >= 0 && currentHoverIdx < plans.length) {
        const copy = [...plans];
        const [movedPlan] = copy.splice(startIdx, 1);
        copy.splice(currentHoverIdx, 0, movedPlan);
        savePlans(copy);
      }

      setDraggedPlanIdx(null);
      setDragOverPlanIdx(null);
    };

    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleFeatPointerStart = (planIndex: number, startFeatIdx: number, startEvent: React.MouseEvent) => {
    startEvent.stopPropagation();
    startEvent.preventDefault();

    let currentHoverFeatIdx = startFeatIdx;
    const startKey = `${planIndex}_${startFeatIdx}`;
    setDraggedFeatKey(startKey);
    setDragOverFeatKey(startKey);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const elUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!elUnder) return;

      const featCard = elUnder.closest("[data-feat-index]");
      if (featCard) {
        const targetPlanIdxAttr = featCard.getAttribute("data-plan-index");
        const targetFeatIdxAttr = featCard.getAttribute("data-feat-index");
        if (targetPlanIdxAttr !== null && targetFeatIdxAttr !== null) {
          const tPlanIdx = parseInt(targetPlanIdxAttr, 10);
          const tFeatIdx = parseInt(targetFeatIdxAttr, 10);
          if (tPlanIdx === planIndex && !isNaN(tFeatIdx) && tFeatIdx !== currentHoverFeatIdx) {
            currentHoverFeatIdx = tFeatIdx;
            setDragOverFeatKey(`${planIndex}_${tFeatIdx}`);
          }
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";

      const targetFeatures = plans[planIndex]?.features || [];
      if (currentHoverFeatIdx !== startFeatIdx && currentHoverFeatIdx >= 0 && currentHoverFeatIdx < targetFeatures.length) {
        const copyFeats = [...targetFeatures];
        const [movedFeat] = copyFeats.splice(startFeatIdx, 1);
        copyFeats.splice(currentHoverFeatIdx, 0, movedFeat);
        handleUpdatePlan(planIndex, { features: copyFeats });
      }

      setDraggedFeatKey(null);
      setDragOverFeatKey(null);
    };

    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const savePlans = (newPlans: PricingPlan[]) => {
    updateProp("pricingPlans", newPlans);
    updateProp("pricePlans", newPlans);
  };

  const handleAddPlan = () => {
    const newId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPlan: PricingPlan = {
      id: newId,
      name: `Plan ${plans.length + 1}`,
      price: "29",
      currency: "$",
      period: "/ month",
      description: "Custom pricing plan description.",
      isPopular: false,
      isRecommended: false,
      badgeText: "POPULAR",
      showBadge: false,
      buttonText: "Choose Plan",
      buttonUrl: "#",
      buttonAlignment: "full",
      features: [
        { id: `f_${Date.now()}_1`, text: "Feature 1", included: true },
        { id: `f_${Date.now()}_2`, text: "Feature 2", included: true },
        { id: `f_${Date.now()}_3`, text: "Feature 3", included: false },
      ],
    };
    const updated = [...plans, newPlan];
    savePlans(updated);
    setExpandedPlanId(newId);
  };

  const handleUpdatePlan = (idx: number, patch: Partial<PricingPlan>) => {
    const copy = [...plans];
    copy[idx] = { ...copy[idx], ...patch };
    savePlans(copy);
  };

  const handleDeletePlan = (idx: number) => {
    const updated = plans.filter((_, i) => i !== idx);
    savePlans(updated);
    if (expandedPlanId === plans[idx]?.id) {
      setExpandedPlanId(updated[0]?.id || null);
    }
  };

  const handleDuplicatePlan = (idx: number) => {
    const source = plans[idx];
    const newId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const copy: PricingPlan = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      features: (source.features || []).map((f) => ({
        ...f,
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })),
    };
    const updated = [...plans];
    updated.splice(idx + 1, 0, copy);
    savePlans(updated);
    setExpandedPlanId(newId);
  };

  const handleMovePlan = (idx: number, direction: "up" | "down") => {
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === plans.length - 1)) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...plans];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    savePlans(updated);
  };

  return (
    <div className="space-y-4">
      {/* 1. Layout & Alignment */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Grid & Card Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Columns</label>
            <select
              value={el.pricingColumns || 3}
              onChange={(e) => updateProp("pricingColumns", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value={1}>1 Column</option>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Gap Spacing (px)</label>
            <input
              type="number"
              min={8}
              max={64}
              value={el.pricingGap ?? 24}
              onChange={(e) => updateProp("pricingGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Alignment</label>
          <select
            value={el.pricingAlignment || "center"}
            onChange={(e) => updateProp("pricingAlignment", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="left">Left Align</option>
            <option value="center">Center Align</option>
            <option value="right">Right Align</option>
          </select>
        </div>
      </div>

      {/* 2. Colors & Corner Radius */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Card & Accent Styling
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Card Background</label>
            <input
              type="color"
              value={el.pricingCardBg || "#ffffff"}
              onChange={(e) => updateProp("pricingCardBg", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Card Border</label>
            <input
              type="color"
              value={el.pricingCardBorder || "#e2e8f0"}
              onChange={(e) => updateProp("pricingCardBorder", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Highlight Ring / Badge</label>
            <input
              type="color"
              value={el.pricingHighlightColor || "#2563eb"}
              onChange={(e) => updateProp("pricingHighlightColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border Radius</label>
            <select
              value={el.pricingCardRadius || "24px"}
              onChange={(e) => updateProp("pricingCardRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="8px">Small (8px)</option>
              <option value="12px">Medium (12px)</option>
              <option value="16px">Large (16px)</option>
              <option value="24px">Extra Large (24px)</option>
              <option value="32px">Full Pill (32px)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. CTA Button Styling */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          CTA Button Styling
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Button Background</label>
            <input
              type="color"
              value={el.pricingBtnBg || "#2563eb"}
              onChange={(e) => updateProp("pricingBtnBg", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Button Text Color</label>
            <input
              type="color"
              value={el.pricingBtnColor || "#ffffff"}
              onChange={(e) => updateProp("pricingBtnColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Button Hover Bg</label>
            <input
              type="color"
              value={el.pricingBtnHoverBg || "#1d4ed8"}
              onChange={(e) => updateProp("pricingBtnHoverBg", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Button Hover Text</label>
            <input
              type="color"
              value={el.pricingBtnHoverColor || "#ffffff"}
              onChange={(e) => updateProp("pricingBtnHoverColor", e.target.value)}
              className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
            />
          </div>
        </div>
      </div>

      {/* 4. Plans List Manager */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Pricing Plans ({plans.length})
          </span>
          <button
            type="button"
            onClick={handleAddPlan}
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 transition cursor-pointer active:scale-95 shadow-xs"
          >
            + Add Plan
          </button>
        </div>

        <div className="space-y-2.5">
          {plans.map((plan, planIdx) => {
            const isExpanded = expandedPlanId === plan.id;
            const isHighlight = Boolean(plan.isPopular || plan.isRecommended);

            return (
              <div
                key={plan.id}
                data-plan-index={planIdx}
                draggable={true}
                onDragStart={(e) => {
                  e.stopPropagation();
                  draggedPlanIdxRef.current = planIdx;
                  try {
                    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "plan", planIdx }));
                    e.dataTransfer.effectAllowed = "move";
                  } catch (err) {}
                  setTimeout(() => setDraggedPlanIdx(planIdx), 0);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    e.dataTransfer.dropEffect = "move";
                  } catch (err) {}
                  if (dragOverPlanIdx !== planIdx) setDragOverPlanIdx(planIdx);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverPlanIdx !== planIdx) setDragOverPlanIdx(planIdx);
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  if (dragOverPlanIdx === planIdx) setDragOverPlanIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  let sourcePlanIdx = draggedPlanIdxRef.current;
                  if (sourcePlanIdx === null) {
                    try {
                      const raw = e.dataTransfer.getData("text/plain");
                      const parsed = JSON.parse(raw);
                      if (parsed && parsed.type === "plan") sourcePlanIdx = parsed.planIdx;
                    } catch (err) {}
                  }

                  if (
                    sourcePlanIdx !== null &&
                    sourcePlanIdx !== planIdx &&
                    sourcePlanIdx >= 0 &&
                    sourcePlanIdx < plans.length
                  ) {
                    const updated = [...plans];
                    const [movedPlan] = updated.splice(sourcePlanIdx, 1);
                    updated.splice(planIdx, 0, movedPlan);
                    savePlans(updated);
                  }
                  draggedPlanIdxRef.current = null;
                  setDraggedPlanIdx(null);
                  setDragOverPlanIdx(null);
                }}
                onDragEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  draggedPlanIdxRef.current = null;
                  setDraggedPlanIdx(null);
                  setDragOverPlanIdx(null);
                }}
                className={`rounded-xl border transition-all duration-200 bg-white ${
                  draggedPlanIdx === planIdx
                    ? "opacity-30 border-dashed border-blue-400 bg-blue-50/20 scale-[0.98]"
                    : dragOverPlanIdx === planIdx
                    ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/40 shadow-md"
                    : isHighlight
                    ? "border-amber-300 ring-1 ring-amber-200"
                    : "border-slate-200"
                }`}
              >
                {/* Accordion Header */}
                <div
                  className="flex items-center justify-between p-2.5 cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 rounded-t-xl"
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      draggable={true}
                      onMouseDown={(e) => handlePlanPointerStart(planIdx, e)}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        draggedPlanIdxRef.current = planIdx;
                        try {
                          e.dataTransfer.setData("text/plain", JSON.stringify({ type: "plan", planIdx }));
                          e.dataTransfer.effectAllowed = "move";
                        } catch (err) {}
                        setTimeout(() => setDraggedPlanIdx(planIdx), 0);
                      }}
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-slate-100 transition shrink-0 flex items-center select-none"
                      title="Click & Drag mouse to reorder plan"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 16 16">
                        <circle cx="5" cy="3" r="1.3"/>
                        <circle cx="11" cy="3" r="1.3"/>
                        <circle cx="5" cy="8" r="1.3"/>
                        <circle cx="11" cy="8" r="1.3"/>
                        <circle cx="5" cy="13" r="1.3"/>
                        <circle cx="11" cy="13" r="1.3"/>
                      </svg>
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {plan.name || "Untitled Plan"}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                      {plan.currency || "$"}{plan.price}
                    </span>
                    {isHighlight && (
                      <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                        Popular
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Move Up"
                      disabled={planIdx === 0}
                      onClick={() => handleMovePlan(planIdx, "up")}
                      className="h-6 w-6 rounded border border-slate-200 bg-white text-[10px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Move Down"
                      disabled={planIdx === plans.length - 1}
                      onClick={() => handleMovePlan(planIdx, "down")}
                      className="h-6 w-6 rounded border border-slate-200 bg-white text-[10px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      title="Duplicate Plan"
                      onClick={() => handleDuplicatePlan(planIdx)}
                      className="h-6 w-6 rounded border border-slate-200 bg-white text-[10px] text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      title="Delete Plan"
                      onClick={() => handleDeletePlan(planIdx)}
                      className="h-6 w-6 rounded border border-red-200 bg-red-50 text-[10px] text-red-600 hover:bg-red-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="p-3 border-t border-slate-100 space-y-3" onDragStart={(e) => e.stopPropagation()}>
                    {/* Name & Highlight */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Plan Name</label>
                        <input
                          type="text"
                          value={plan.name}
                          onChange={(e) => handleUpdatePlan(planIdx, { name: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center pt-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-amber-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(plan.isPopular || plan.isRecommended)}
                            onChange={(e) =>
                              handleUpdatePlan(planIdx, {
                                isPopular: e.target.checked,
                                isRecommended: e.target.checked,
                                showBadge: e.target.checked ? true : plan.showBadge,
                              })
                            }
                            className="accent-amber-500 rounded"
                          />
                          <span>Recommended Plan</span>
                        </label>
                      </div>
                    </div>

                    {/* Price, Currency, Period */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Currency</label>
                        <input
                          type="text"
                          value={plan.currency ?? "$"}
                          onChange={(e) => handleUpdatePlan(planIdx, { currency: e.target.value })}
                          placeholder="$"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Price</label>
                        <input
                          type="text"
                          value={plan.price}
                          onChange={(e) => handleUpdatePlan(planIdx, { price: e.target.value })}
                          placeholder="29"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Period</label>
                        <input
                          type="text"
                          value={plan.period}
                          onChange={(e) => handleUpdatePlan(planIdx, { period: e.target.value })}
                          placeholder="/ month"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Description</label>
                      <input
                        type="text"
                        value={plan.description || ""}
                        onChange={(e) => handleUpdatePlan(planIdx, { description: e.target.value })}
                        placeholder="Plan subtitle or description..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Badge Controls */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pt-3">
                        <input
                          type="checkbox"
                          checked={plan.showBadge !== false && Boolean(plan.badgeText || plan.isPopular)}
                          onChange={(e) => handleUpdatePlan(planIdx, { showBadge: e.target.checked })}
                          className="accent-blue-600 rounded"
                        />
                        <span>Display Badge</span>
                      </label>
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Badge Text</label>
                        <input
                          type="text"
                          value={plan.badgeText || "MOST POPULAR"}
                          onChange={(e) => handleUpdatePlan(planIdx, { badgeText: e.target.value })}
                          placeholder="e.g. MOST POPULAR"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-700 outline-none focus:border-blue-500 uppercase"
                        />
                      </div>
                    </div>

                    {/* CTA Button Settings */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">CTA Button Settings</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={plan.buttonText}
                          onChange={(e) => handleUpdatePlan(planIdx, { buttonText: e.target.value })}
                          placeholder="Button Text..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={plan.buttonUrl}
                          onChange={(e) => handleUpdatePlan(planIdx, { buttonUrl: e.target.value })}
                          placeholder="URL Link..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-600 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Features Manager */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase">
                          Features ({(plan.features || []).length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentFeats = plan.features || [];
                            const newFeat: PricePlanFeature = {
                              id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                              text: `New Feature`,
                              included: true,
                            };
                            handleUpdatePlan(planIdx, { features: [...currentFeats, newFeat] });
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          + Add Feature
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {(plan.features || []).map((feat, featIdx) => {
                          const featKey = `${planIdx}_${featIdx}`;
                          return (
                            <div
                              key={feat.id}
                              data-plan-index={planIdx}
                              data-feat-index={featIdx}
                              draggable={true}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                draggedFeatKeyRef.current = featKey;
                                try {
                                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "feature", planIdx, featIdx }));
                                  e.dataTransfer.effectAllowed = "move";
                                } catch (err) {}
                                setTimeout(() => setDraggedFeatKey(featKey), 0);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  e.dataTransfer.dropEffect = "move";
                                } catch (err) {}
                                if (dragOverFeatKey !== featKey) setDragOverFeatKey(featKey);
                              }}
                              onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (dragOverFeatKey !== featKey) setDragOverFeatKey(featKey);
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                if (dragOverFeatKey === featKey) setDragOverFeatKey(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                let refKey = draggedFeatKeyRef.current;
                                if (!refKey) {
                                  try {
                                    const raw = e.dataTransfer.getData("text/plain");
                                    const parsed = JSON.parse(raw);
                                    if (parsed && parsed.type === "feature") refKey = `${parsed.planIdx}_${parsed.featIdx}`;
                                  } catch (err) {}
                                }

                                if (refKey) {
                                  const [sPlanIdxStr, sFeatIdxStr] = refKey.split("_");
                                  const sPlanIdx = parseInt(sPlanIdxStr, 10);
                                  const sFeatIdx = parseInt(sFeatIdxStr, 10);
                                  if (sPlanIdx === planIdx && sFeatIdx !== featIdx) {
                                    const copyFeats = [...(plan.features || [])];
                                    const [movedFeat] = copyFeats.splice(sFeatIdx, 1);
                                    copyFeats.splice(featIdx, 0, movedFeat);
                                    handleUpdatePlan(planIdx, { features: copyFeats });
                                  }
                                }
                                draggedFeatKeyRef.current = null;
                                setDraggedFeatKey(null);
                                setDragOverFeatKey(null);
                              }}
                              onDragEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                draggedFeatKeyRef.current = null;
                                setDraggedFeatKey(null);
                                setDragOverFeatKey(null);
                              }}
                              className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all duration-150 ${
                                draggedFeatKey === featKey
                                  ? "opacity-30 border-dashed border-blue-400 bg-blue-50/30 font-normal"
                                  : dragOverFeatKey === featKey
                                  ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/60 shadow-xs"
                                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              {/* Drag handle */}
                              <span
                                draggable={true}
                                onMouseDown={(e) => handleFeatPointerStart(planIdx, featIdx, e)}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  draggedFeatKeyRef.current = featKey;
                                  try {
                                    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "feature", planIdx, featIdx }));
                                    e.dataTransfer.effectAllowed = "move";
                                  } catch (err) {}
                                  setTimeout(() => setDraggedFeatKey(featKey), 0);
                                }}
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-slate-200/60 transition shrink-0 flex items-center select-none"
                                title="Click & Drag mouse to reorder feature"
                              >
                                <svg className="w-3.5 h-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 16 16">
                                  <circle cx="5" cy="3" r="1.3"/>
                                  <circle cx="11" cy="3" r="1.3"/>
                                  <circle cx="5" cy="8" r="1.3"/>
                                  <circle cx="11" cy="8" r="1.3"/>
                                  <circle cx="5" cy="13" r="1.3"/>
                                  <circle cx="11" cy="13" r="1.3"/>
                                </svg>
                              </span>

                              {/* Toggle included */}
                              <button
                                type="button"
                                title={feat.included ? "Mark as Excluded" : "Mark as Included"}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                                onClick={() => {
                                  const copyFeats = [...(plan.features || [])];
                                  copyFeats[featIdx] = { ...copyFeats[featIdx], included: !copyFeats[featIdx].included };
                                  handleUpdatePlan(planIdx, { features: copyFeats });
                                }}
                                className={`h-5 w-5 rounded text-[10px] font-extrabold shrink-0 flex items-center justify-center cursor-pointer transition ${
                                  feat.included ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-slate-200 text-slate-500 border border-slate-300"
                                }`}
                              >
                                {feat.included ? "✓" : "✕"}
                              </button>

                              {/* Feature Text */}
                              <input
                                type="text"
                                value={feat.text}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const copyFeats = [...(plan.features || [])];
                                  copyFeats[featIdx] = { ...copyFeats[featIdx], text: e.target.value };
                                  handleUpdatePlan(planIdx, { features: copyFeats });
                                }}
                                className="w-full text-xs text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 outline-none focus:border-blue-500"
                              />

                              {/* Move Up/Down */}
                              <div className="flex items-center gap-0.5 shrink-0" onDragStart={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={featIdx === 0}
                                  onClick={() => {
                                    const copyFeats = [...(plan.features || [])];
                                    const [m] = copyFeats.splice(featIdx, 1);
                                    copyFeats.splice(featIdx - 1, 0, m);
                                    handleUpdatePlan(planIdx, { features: copyFeats });
                                  }}
                                  className="h-5 w-5 rounded border border-slate-200 bg-white text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={featIdx === (plan.features || []).length - 1}
                                  onClick={() => {
                                    const copyFeats = [...(plan.features || [])];
                                    const [m] = copyFeats.splice(featIdx, 1);
                                    copyFeats.splice(featIdx + 1, 0, m);
                                    handleUpdatePlan(planIdx, { features: copyFeats });
                                  }}
                                  className="h-5 w-5 rounded border border-slate-200 bg-white text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-20 cursor-pointer"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copyFeats = (plan.features || []).filter((_, i) => i !== featIdx);
                                    handleUpdatePlan(planIdx, { features: copyFeats });
                                  }}
                                  className="h-5 w-5 rounded border border-red-200 bg-red-50 text-[10px] text-red-600 hover:bg-red-100 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
