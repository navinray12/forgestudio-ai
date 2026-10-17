/**
 * CountdownWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useEffect } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

export const CountdownWidgetRenderer = ({
  el,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const targetDateStr = el.countdownTargetDate || "2026-12-31T23:59";
  const showDays = el.countdownShowDays !== false;
  const showHours = el.countdownShowHours !== false;
  const showMinutes = el.countdownShowMinutes !== false;
  const showSeconds = el.countdownShowSeconds !== false;
  const expiredMessage = el.countdownExpiredMessage || "Event Has Ended!";
  const alignment = el.countdownAlignment || "center";
  const gap = el.countdownGap ?? 16;
  const boxBg = el.countdownBoxBg || "#ffffff";
  const boxBorder = el.countdownBoxBorder || "#e2e8f0";
  const boxRadius = el.countdownBoxRadius || "16px";
  const numberColor = el.countdownNumberColor || "#0f172a";
  const numberSize = el.countdownNumberSize || "32px";
  const labelColor = el.countdownLabelColor || "#64748b";
  const labelSize = el.countdownLabelSize || "11px";
  const labelTransform = el.countdownLabelTransform || "uppercase";
  const daysLabel = el.countdownDaysLabel || "Days";
  const hoursLabel = el.countdownHoursLabel || "Hours";
  const minutesLabel = el.countdownMinutesLabel || "Minutes";
  const secondsLabel = el.countdownSecondsLabel || "Seconds";

  const calculateTimeLeft = (targetStr: string) => {
    const targetTime = new Date(targetStr).getTime();
    const now = Date.now();
    const diff = targetTime - now;

    if (isNaN(targetTime) || diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds, isExpired: false };
  };

  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDateStr));

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(targetDateStr));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDateStr));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDateStr]);

  const justifyClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  if (timeLeft.isExpired) {
    return (
      <div
        className="w-full py-8 px-6 text-center rounded-2xl border shadow-xs flex flex-col items-center justify-center"
        style={{
          backgroundColor: boxBg,
          borderColor: boxBorder,
          borderRadius: boxRadius,
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        <span className="text-2xl mb-1">⌛</span>
        <h4
          className="font-bold text-base tracking-tight"
          style={{ color: numberColor, fontSize: mergedStyles.fontSize || "18px" }}
        >
          {expiredMessage}
        </h4>
      </div>
    );
  }

  const items = [
    { show: showDays, val: timeLeft.days, label: daysLabel },
    { show: showHours, val: timeLeft.hours, label: hoursLabel },
    { show: showMinutes, val: timeLeft.minutes, label: minutesLabel },
    { show: showSeconds, val: timeLeft.seconds, label: secondsLabel },
  ].filter((item) => item.show);

  return (
    <div
      className={`w-full flex flex-wrap items-center ${justifyClass}`}
      style={{
        gap: `${gap}px`,
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        fontFamily: mergedStyles.fontFamily,
      }}
    >
      {items.map((item, idx) => {
        const valStr = String(item.val).padStart(2, "0");
        return (
          <div
            key={idx}
            className="flex min-w-[76px] flex-col items-center justify-center p-3.5 border shadow-xs transition-transform hover:-translate-y-0.5"
            style={{
              backgroundColor: boxBg,
              borderColor: boxBorder,
              borderRadius: boxRadius,
            }}
          >
            <span
              className="font-extrabold font-mono tracking-tight leading-none"
              style={{
                color: numberColor,
                fontSize: numberSize,
              }}
            >
              {valStr}
            </span>
            <span
              className="font-bold tracking-wider mt-1.5"
              style={{
                color: labelColor,
                fontSize: labelSize,
                textTransform: labelTransform,
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
