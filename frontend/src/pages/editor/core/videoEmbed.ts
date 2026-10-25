// YouTube & Vimeo Embed Helpers (F-208 Video Widget). Moved verbatim from WebsiteEditor.tsx, which imports it from here.

export const getYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export const getVimeoId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.trim().match(regExp);
  return match ? match[1] : null;
};
