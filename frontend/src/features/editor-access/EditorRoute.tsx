import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { EditorSessionBoundary } from "./EditorSessionBoundary";

const WebsiteEditor = lazy(() => import("../../pages/editor/WebsiteEditor"));

/** Route identity owns the entire editor session. Changing sites cannot retain
 * the previous site's document, global styles, undo history or async callbacks.
 */
export default function EditorRoute() {
  const { websiteId } = useParams<{ websiteId: string }>();
  if (!websiteId) return null;
  return (
    <EditorSessionBoundary websiteId={websiteId}>
      <Suspense fallback={<main className="min-h-screen bg-slate-950 text-slate-300 p-6" aria-busy="true">Loading editor…</main>}>
        <WebsiteEditor key={websiteId} />
      </Suspense>
    </EditorSessionBoundary>
  );
}
