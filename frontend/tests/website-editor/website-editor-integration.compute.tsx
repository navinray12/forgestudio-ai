/**
 * Drives the real editor with richSite() and records what reaches the outside world: rendered
 * canvas markup for elements styled/embedded by the extracted helpers, the manual-save request,
 * the publish request, and the localStorage draft written by publish. The golden was recorded from
 * the unmodified editor. The only normalised value is the random Idempotency-Key.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, mountEditor } from "./editor-harness";
import { RICH_RENDER_IDS, richSite } from "./website-editor-integration.fixtures";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export async function captureIntegration() {
  const { backend, canvasEl, consoleErrors, key } = await mountEditor(richSite());
  const rendered = Object.fromEntries(RICH_RENDER_IDS.map((id) => [id, canvasEl(id)?.outerHTML ?? null]));

  await key("s", { ctrlKey: true });
  await waitFor(() => expect(backend.saves()).toHaveLength(1));
  const put = backend.saves()[0];
  const save = {
    method: put.method, url: put.url,
    headers: { ...put.headers, "Idempotency-Key": KEY_PATTERN.test(put.headers["Idempotency-Key"] ?? "") ? "(valid key)" : put.headers["Idempotency-Key"] },
    body: put.body,
  };

  fireEvent.click(screen.getByTitle("Publish Website"));
  await flush(3);
  fireEvent.click(screen.getByText(/Publish Now/));
  await waitFor(() => expect(backend.publishes()).toHaveLength(1));
  await flush(4);
  const post = backend.publishes()[0];
  const publish = { method: post.method, url: post.url, headers: post.headers, body: post.body };
  let draft: unknown = null;
  try { draft = JSON.parse(localStorage.getItem("forgestudio_editor_site1") ?? "null"); } catch { draft = "(unreadable)"; }

  return { rendered, save, publish, localStorageDraft: draft, consoleErrors };
}
