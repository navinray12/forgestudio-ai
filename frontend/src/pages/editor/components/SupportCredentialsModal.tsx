import { useEffect, useRef } from "react";
import { SessionManagement } from "../../../features/identity/SessionManagement";
interface SupportCredentialsModalProps { isOpen: boolean; onClose: () => void }
export function SupportCredentialsModal({ isOpen, onClose }: SupportCredentialsModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen) dialog.current?.showModal(); else dialog.current?.close();
  }, [isOpen]);
  return <dialog ref={dialog} onCancel={onClose} className="max-w-xl rounded-xl border border-slate-600 bg-slate-900 text-slate-100 p-6 backdrop:bg-black/70">
    <h2 className="text-xl font-semibold">Account access</h2>
    <p className="my-4">Shareable support credentials are no longer issued. They could give unrestricted account access.
      Scoped support grants require a separate approved support workflow.</p>
    {isOpen && <SessionManagement />}
    <button className="mt-6 rounded border px-4 py-2" onClick={onClose}>Close</button>
  </dialog>;
}
