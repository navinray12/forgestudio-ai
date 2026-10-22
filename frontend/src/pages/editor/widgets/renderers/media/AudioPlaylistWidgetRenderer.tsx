/**
 * AudioPlaylistWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef } from "react";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-215: Audio Playlist Renderer */
export const AudioPlaylistWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  onUpdateTracks
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles;
  onUpdateTracks?: (newTracks: any[]) => void;
}) => {
  const tracks = el.audioPlaylistTracks && el.audioPlaylistTracks.length > 0 ? el.audioPlaylistTracks : [
    { id: "tr-1", title: "01. Ambient Solar Echoes", artist: "ForgeStudio Soundscapes", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "06:12" },
    { id: "tr-2", title: "02. Deep Focus Flow", artist: "Acoustic Frequency Labs", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "07:05" },
    { id: "tr-3", title: "03. Midnight Synthesizer", artist: "Cybernetic Wave", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: "05:48" },
  ];
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showAddUrlInput, setShowAddUrlInput] = useState(false);
  const [customTrackTitle, setCustomTrackTitle] = useState("");
  const [customTrackUrl, setCustomTrackUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeTrack = tracks[activeTrackIndex] || tracks[0];
  const cardBg = el.audioPlaylistCardBg || "#0f172a";
  const textColor = el.audioPlaylistTextColor || "#ffffff";
  const accentColor = el.audioPlaylistAccentColor || "#38bdf8";

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setHasError(false);
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  };

  const handleNext = () => {
    setHasError(false);
    setActiveTrackIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setHasError(false);
    setActiveTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const handleAddManualTrack = (url: string, title?: string) => {
    const trackTitle = title || `Custom Audio #${tracks.length + 1}`;
    const newTrack = {
      id: "audio_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      title: trackTitle,
      artist: "Manual Audio Track",
      url,
      duration: "03:30"
    };
    const updated = [...tracks, newTrack];
    if (onUpdateTracks) {
      onUpdateTracks(updated);
    } else if (el) {
      el.audioPlaylistTracks = updated;
    }
    setActiveTrackIndex(updated.length - 1);
    setIsPlaying(true);
    setShowAddUrlInput(false);
    setCustomTrackTitle("");
    setCustomTrackUrl("");
  };

  return (
    <div
      className="w-full rounded-2xl p-5 shadow-xl transition-all relative"
      style={{
        backgroundColor: cardBg,
        color: textColor,
        marginTop: mergedStyles?.marginTop,
        marginBottom: mergedStyles?.marginBottom,
      }}
    >
      <audio
        ref={audioRef}
        src={activeTrack?.url}
        onEnded={handleNext}
        onError={() => { setHasError(true); setIsPlaying(false); }}
      />
      {/* Current Active Track Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: accentColor }}>
            🎵 Audio Player
          </span>
          <h4 className="text-sm font-bold mt-0.5">{activeTrack?.title || "No Track Selected"}</h4>
          {activeTrack?.artist && <p className="text-xs text-white/70">{activeTrack.artist}</p>}
        </div>

        {/* Player Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold transition cursor-pointer"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="h-10 w-10 rounded-full flex items-center justify-center text-slate-900 font-bold transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold transition cursor-pointer"
          >
            ⏭
          </button>
        </div>
      </div>

      {hasError && (
        <div className="p-2.5 mb-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-medium text-center border border-rose-500/30">
          ⚠️ Unable to load audio stream file. Use <strong>"Select Local Audio"</strong> or enter a valid HTTP URL.
        </div>
      )}

      {/* Playlist Tracks List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {tracks.map((track, idx) => {
          const isActive = idx === activeTrackIndex;
          return (
            <div
              key={track.id}
              onClick={() => {
                setActiveTrackIndex(idx);
                setIsPlaying(true);
                setHasError(false);
              }}
              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                isActive ? "bg-white/15 border border-white/20 font-bold" : "hover:bg-white/5 opacity-80"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="text-xs font-mono opacity-60">{idx + 1}</span>
                <span className="text-xs truncate">{track.title}</span>
              </div>
              <span className="text-[11px] font-mono opacity-60 ml-2">{track.duration || "03:30"}</span>
            </div>
          );
        })}
      </div>

      {/* Canvas Manual Audio Add Bar (Editor Only) */}
      {!isPreview && (
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
          {!showAddUrlInput ? (
            <div className="flex items-center justify-between gap-2">
              <label className="shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 shadow transition flex items-center gap-1.5">
                📁 Upload / Select Local Audio File
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    handleAddManualTrack(objectUrl, file.name.replace(/\.[^/.]+$/, ""));
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowAddUrlInput(true)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 transition cursor-pointer flex items-center gap-1"
              >
                🔗 Enter Audio URL
              </button>
            </div>
          ) : (
            <div className="bg-white/10 p-2.5 rounded-xl space-y-2">
              <input
                type="text"
                placeholder="Track Title (e.g. My Song)"
                value={customTrackTitle}
                onChange={(e) => setCustomTrackTitle(e.target.value)}
                className="w-full rounded-lg bg-black/40 px-2.5 py-1 text-xs text-white placeholder-white/50 border border-white/20 outline-none"
              />
              <input
                type="text"
                placeholder="Audio URL (https://... .mp3)"
                value={customTrackUrl}
                onChange={(e) => setCustomTrackUrl(e.target.value)}
                className="w-full rounded-lg bg-black/40 px-2.5 py-1 text-xs font-mono text-white placeholder-white/50 border border-white/20 outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddUrlInput(false)}
                  className="px-2.5 py-1 text-xs text-white/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customTrackUrl.trim()) {
                      handleAddManualTrack(customTrackUrl.trim(), customTrackTitle.trim());
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white shadow"
                >
                  Add Track
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
