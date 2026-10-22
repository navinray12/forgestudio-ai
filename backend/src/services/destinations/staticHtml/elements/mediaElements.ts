import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";

// Media and embeds: Google Maps, Lottie, video and audio playlists.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "google-maps"
export function renderGoogleMapsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const addr = el.mapAddress || el.address || "New York, USA";
  const zoom = el.mapZoom || 14;
  const height = el.mapHeight || 350;
  return `<div class="fs-google-maps"${idAttr}${classAttr}${styleAttr}>
        <iframe width="100%" height="${escapeHtml(String(height))}" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${encodeURIComponent(addr)}&t=m&z=${escapeHtml(String(zoom))}&output=embed" allowfullscreen loading="lazy"></iframe>
      </div>`;
}

// case "lottie"
export function renderLottieElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const lottieUrl = el.lottieUrl || "";
  return `<div class="fs-lottie"${idAttr}${classAttr}${styleAttr} data-lottie="${escapeHtml(lottieUrl)}">
        <div class="fs-lottie-player"></div>
      </div>`;
}

// case "video", "video-playlist"
export function renderVideoElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const src = el.videoUrl || el.src || "";
  const isEmbed = src.includes("youtube.com") || src.includes("youtu.be") || src.includes("vimeo.com");
  return `<div class="fs-video-wrapper"${idAttr}${classAttr}${styleAttr}>
        ${isEmbed ? `<iframe src="${escapeHtml(src)}" frameborder="0" allowfullscreen loading="lazy"></iframe>` : `<video controls src="${escapeHtml(src)}" poster="${escapeHtml(el.videoPoster || "")}"></video>`}
      </div>`;
}

// case "audio-playlist"
export function renderAudioPlaylistElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const tracks = Array.isArray(el.audioPlaylistTracks) ? el.audioPlaylistTracks : (Array.isArray(el.tracks) ? el.tracks : []);
  const tracksHtml = tracks.map((t: any) => `<li>${escapeHtml(t.title || "Track")} - ${escapeHtml(t.artist || "")}</li>`).join("\n");
  return `<div class="fs-audio-playlist"${idAttr}${classAttr}${styleAttr}>
        <audio controls src="${escapeHtml(el.audioUrl || el.src || "")}"></audio>
        ${tracks.length > 0 ? `<ul class="fs-audio-tracks">${tracksHtml}</ul>` : ""}
      </div>`;
}
