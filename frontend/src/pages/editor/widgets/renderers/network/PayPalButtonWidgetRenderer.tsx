/**
 * PayPalButtonWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import { PayPalButtonBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-200: PayPal Button Renderer */
export const PayPalButtonWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const text = el.paypalText || "Pay Now with PayPal";
  const rawAmount = el.paypalAmount || "19.99";
  const currency = el.paypalCurrency || "USD";
  const itemName = el.paypalItemName || "Digital Product";
  const itemDescription = el.paypalItemDescription || "";
  const quantity = el.paypalQuantity || 1;
  const env = el.paypalEnv || "sandbox";
  const alignment = el.paypalAlignment || "left";
  const size = el.paypalButtonSize || "md";
  const shape = el.paypalButtonShape || "pill";
  const bgColor = el.paypalBgColor || "#FFC439";
  const textColor = el.paypalTextColor || "#003087";
  const hoverBgColor = el.paypalHoverBgColor || "#f2b522";
  // Same API base as FormWidgetRenderer: the backend serves these routes only at /api/v1/integrations.
  const apiUrl = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "http://localhost:5000";

  const [isHovered, setIsHovered] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "processing" | "success" | "cancelled" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<{ orderId: string; status: string; transactionId?: string; capturedAt?: string } | null>(null);

  // Amount validation check
  const numAmount = parseFloat(rawAmount);
  const isValidAmount = !isNaN(numAmount) && numAmount > 0;

  const alignClass =
    alignment === "center" ? "justify-center text-center" : alignment === "right" ? "justify-end text-right" : "justify-start text-left";

  const sizeStyles =
    size === "sm"
      ? "px-4 py-2 text-xs gap-1.5"
      : size === "lg"
      ? "px-8 py-4 text-base gap-3 font-extrabold"
      : "px-6 py-3 text-sm gap-2 font-bold";

  const roundedClass = shape === "rect" ? "rounded-lg" : "rounded-full";

  const currencySymbol =
    currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "INR" ? "₹" : currency === "CAD" || currency === "AUD" || currency === "USD" ? "$" : `${currency} `;

  const handleCheckoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;
    if (status === "loading" || status === "processing") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`${apiUrl}/api/v1/integrations/paypal/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: rawAmount,
          currency,
          itemName,
          itemDescription,
          quantity,
          env,
        }),
      });

      const orderData = await res.json();

      if (!res.ok || !orderData.success) {
        throw new Error(orderData.message || "Failed to create PayPal checkout order.");
      }

      setStatus("processing");

      // Open PayPal approval window or handle sandbox simulation
      let popupWindow: Window | null = null;
      if (orderData.approveUrl) {
        popupWindow = window.open(orderData.approveUrl, "PayPalCheckout", "width=600,height=700");
      }

      // Execute capture API
      const captureRes = await fetch(`${apiUrl}/api/v1/integrations/paypal/capture-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderData.orderId }),
      });

      const captureData = await captureRes.json();

      if (popupWindow && !popupWindow.closed) {
        try {
          popupWindow.close();
        } catch (_) {}
      }

      if (captureRes.ok && captureData.success) {
        setReceipt({
          orderId: orderData.orderId,
          status: captureData.status || "COMPLETED",
          transactionId: captureData.transactionId || "TXN-" + orderData.orderId,
          capturedAt: captureData.capturedAt || new Date().toISOString(),
        });

        if (el.paypalSuccessAction === "redirect" && el.paypalSuccessRedirectUrl) {
          window.location.href = el.paypalSuccessRedirectUrl;
        } else {
          setStatus("success");
        }
      } else {
        throw new Error(captureData.message || "Payment capture was not completed.");
      }
    } catch (err: any) {
      console.error("[PayPal Checkout Error]", err);
      if (err?.message?.includes("cancel")) {
        setStatus("cancelled");
      } else {
        setErrorMsg(err?.message || "An unexpected error occurred during PayPal checkout.");
        setStatus("error");
      }
    }
  };

  return (
    <div
      className={`w-full flex flex-col ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      {/* Validation Warning */}
      {!isValidAmount && (
        <div className="mb-2 max-w-sm rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center gap-2">
          <span>⚠️</span>
          <span><strong>Invalid Amount:</strong> Please enter a positive numerical amount in the PayPal Inspector panel.</span>
        </div>
      )}

      {/* State: Success Card */}
      {status === "success" && (
        <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 shadow-md space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-700 text-sm">
              <span>✅</span> Payment Successful!
            </span>
            <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full uppercase">
              {env === "live" ? "Live" : "Sandbox"}
            </span>
          </div>
          <p className="text-xs font-medium">{el.paypalSuccessMessage || "🎉 Payment received! Thank you for your order."}</p>
          <div className="pt-2 border-t border-emerald-200/60 text-[11px] font-mono text-emerald-800 space-y-0.5">
            <div><span className="font-semibold text-emerald-900">Item:</span> {itemName} (x{quantity})</div>
            <div><span className="font-semibold text-emerald-900">Amount Paid:</span> {currencySymbol}{numAmount.toFixed(2)} {currency}</div>
            <div><span className="font-semibold text-emerald-900">Order ID:</span> {receipt?.orderId}</div>
            {receipt?.transactionId && <div><span className="font-semibold text-emerald-900">Txn ID:</span> {receipt.transactionId}</div>}
          </div>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
          >
            ← Pay Again / Test Reset
          </button>
        </div>
      )}

      {/* State: Cancelled Message */}
      {status === "cancelled" && (
        <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs flex items-center justify-between gap-2">
          <span>{el.paypalCancelMessage || "Payment was cancelled. You can retry whenever you are ready."}</span>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white rounded-md hover:bg-amber-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* State: Error Box */}
      {status === "error" && (
        <div className="max-w-md w-full rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-red-700">
            <span>❌</span> Payment Failed
          </div>
          <p>{errorMsg || "PayPal transaction could not be completed."}</p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* State: Default / Idle / Loading Button */}
      {status !== "success" && (
        <div className={`inline-flex ${alignClass}`}>
          <button
            type="button"
            onClick={handleCheckoutClick}
            disabled={!isValidAmount || status === "loading" || status === "processing"}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`inline-flex items-center font-sans shadow-xs transition-all duration-200 cursor-pointer hover:shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${roundedClass} ${sizeStyles}`}
            style={{
              backgroundColor: isHovered ? hoverBgColor : bgColor,
              color: textColor,
              borderRadius: mergedStyles.borderRadius,
            }}
          >
            {status === "loading" || status === "processing" ? (
              <>
                <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{status === "loading" ? "Initializing PayPal..." : "Processing Order..."}</span>
              </>
            ) : (
              <>
                <PayPalButtonBoxIcon />
                <span>{text}</span>
                {isValidAmount && (
                  <span className="text-[11px] opacity-85 font-mono ml-0.5">({currencySymbol}{numAmount.toFixed(2)})</span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
