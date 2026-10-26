/**
 * AudioPlaylistInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { triggerImagePicker } from "../shared/imagePicker";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// 28. Audio Playlist Inspector - Manual Audio File & Track Manager
export function AudioPlaylistInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const tracks = el.audioPlaylistTracks && el.audioPlaylistTracks.length > 0
    ? el.audioPlaylistTracks
    : [
        { id: "tr-1", title: "01. Ambient Solar Echoes", artist: "ForgeStudio Soundscapes", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "06:12" },
        { id: "tr-2", title: "02. Deep Focus Flow", artist: "Acoustic Frequency Labs", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "07:05" },
        { id: "tr-3", title: "03. Midnight Synthesizer", artist: "Cybernetic Wave", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: "05:48" }
      ];

  return (
    <div className="space-y-4">
      {/* Player Styling Options */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <span>🎨</span> Player Styling
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Card Background</label>
            <input
              type="color"
              value={el.audioPlaylistCardBg || "#0f172a"}
              onChange={(e) => updateProp("audioPlaylistCardBg", e.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Accent Color</label>
            <input
              type="color"
              value={el.audioPlaylistAccentColor || "#38bdf8"}
              onChange={(e) => updateProp("audioPlaylistAccentColor", e.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            />
          </div>
        </div>
      </div>

      {/* Manual Audio Track Manager */}
      <UniversalItemManager<{ id: string; title: string; artist?: string; url: string; duration?: string }>
        title="Audio Playlist Tracks (Manual Add)"
        items={tracks}
        onUpdate={(newTracks) => updateProp("audioPlaylistTracks", newTracks)}
        createDefaultItem={() => ({
          id: "audio_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          title: "New Custom Audio Track",
          artist: "Artist / Composer",
          url: "",
          duration: "03:30"
        })}
        getItemHeaderLabel={(track) => track.title || "Untitled Audio Track"}
        renderItemFields={(track, _idx, updateTrack) => (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Track Title</label>
              <input
                type="text"
                value={track.title}
                onChange={(e) => updateTrack({ title: e.target.value })}
                placeholder="e.g. Podcast Episode #1"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Artist / Author</label>
              <input
                type="text"
                value={track.artist || ""}
                onChange={(e) => updateTrack({ artist: e.target.value })}
                placeholder="e.g. Studio Recording"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Audio File / Stream URL</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={track.url || ""}
                  onChange={(e) => updateTrack({ url: e.target.value })}
                  placeholder="https://example.com/audio.mp3"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    triggerImagePicker((uploadedUrl) => {
                      updateTrack({ url: uploadedUrl });
                    });
                  }}
                  className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition cursor-pointer flex items-center gap-1"
                >
                  📁 Select Audio
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Supports local audio file upload (.mp3, .wav, .aac, .ogg) or HTTP stream URL.</p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Duration String</label>
              <input
                type="text"
                value={track.duration || "03:30"}
                onChange={(e) => updateTrack({ duration: e.target.value })}
                placeholder="e.g. 04:15"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
