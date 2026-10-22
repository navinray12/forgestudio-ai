import React from "react";
import type { PeerItem } from "../../../features/collaboration/hooks/useCanvasPresence";

/** What renderPeerCursors reads: the editor values and callbacks the inline JSX used. */
export interface PeerCursorsDeps {
  canvasPeers: PeerItem[];
}

/**
 * Canvas: live collaboration cursors of other editors (canvas presence).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3554-3582 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPeerCursors({
  canvasPeers,
}: PeerCursorsDeps): React.ReactNode {
  return (
          canvasPeers.map((peer) => {
            if (!peer.cursor) return null;
            return (
              <div
                key={`cursor-${peer.socketId}`}
                className="pointer-events-none absolute z-50 transition-all duration-75 ease-out"
                style={{
                  left: `${peer.cursor.x}px`,
                  top: `${peer.cursor.y}px`,
                }}
              >
                <svg
                  className="w-4 h-4 drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill={peer.user.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <path d="M5.653 3.123A1 1 0 0 0 4.19 4.316l3.5 14.5a1 1 0 0 0 1.838.256l3.224-6.448 6.448-3.224a1 1 0 0 0 .256-1.838l-14.5-3.5z" />
                </svg>
                <div
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-md whitespace-nowrap ml-3 -mt-2"
                  style={{ backgroundColor: peer.user.color }}
                >
                  {peer.user.name}
                </div>
              </div>
            );
          })
  );
}
