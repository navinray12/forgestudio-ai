import { DocumentSaveError, draftWritePayload, saveAuthorizedWebsite, type DocumentAcknowledgement, type DocumentWriteOptions } from "./save-authorized-website";
type Sender = (payload: unknown, options: DocumentWriteOptions) => Promise<DocumentAcknowledgement>;
/** Shared by manual save and autosave for one mounted editor. An uncertain
 * command retains its immutable bytes/key; newer commands wait for reconciliation.
 * A conflict is never repaired by silently applying the draft to a newer version. */
export class DocumentSaveCoordinator {
  private version: number | null = null;
  private tail: Promise<void> = Promise.resolve();
  private pending: { payload: unknown; options: DocumentWriteOptions; send?: Sender } | null = null;
  private blocked: DocumentSaveError | null = null;
  private generation = 0;
  private readonly send: Sender;
  private readonly makeKey: () => string;
  constructor(send: Sender, makeKey: () => string = () => crypto.randomUUID()) { this.send = send; this.makeKey = makeKey; }
  initialize(version: number): void {
    if (!Number.isInteger(version) || version < 1) throw new DocumentSaveError("Invalid document version", 428, "DOCUMENT_PRECONDITION_REQUIRED");
    this.generation++; this.version = version; this.pending = null; this.blocked = null;
  }
  save(input: unknown, signal?: AbortSignal): Promise<DocumentAcknowledgement> {
    const payload = draftWritePayload(input); const generation = this.generation;
    const work = this.tail.then(async () => {
      if (generation !== this.generation || this.version === null) throw new DocumentSaveError("Reload the current website before saving", 428, "DOCUMENT_PRECONDITION_REQUIRED");
      if (this.blocked) throw this.blocked;
      if (signal?.aborted) throw new DocumentSaveError("Save cancelled before submission", 0, "DOCUMENT_CANCELLED");
      if (this.pending) {
        if (this.pending.send) {
          await this.submit(this.pending, signal, generation);
          this.generation++;
          this.blocked = new DocumentSaveError("The AI apply was confirmed. Reload the accepted document before further saves; copy any local edits first.", 409, "DOCUMENT_SCOPE_CHANGED");
          throw this.blocked;
        }
        const samePayload = JSON.stringify(this.pending.payload) === JSON.stringify(payload);
        const recovered = await this.submit(this.pending, signal, generation);
        if (samePayload) return recovered;
      }
      const pending = { payload, options: { expectedVersion: this.version!, key: this.makeKey() } };
      this.pending = pending;
      return this.submit(pending, signal, generation);
    });
    this.tail = work.then(() => undefined, () => undefined);
    return work;
  }
  /** Queue approved proposals with manual saves. Retain the original sender/key
   * after an uncertain response and invalidate autosaves captured before apply. */
  applyExternal(payload: unknown, expectedVersion: number, key: string, send: Sender): Promise<DocumentAcknowledgement> {
    const generation = this.generation;
    const work = this.tail.then(async () => {
      if (generation !== this.generation || this.version === null) throw new DocumentSaveError("Reload the website before applying", 409, "DOCUMENT_SCOPE_CHANGED");
      if (this.blocked) throw this.blocked;
      if (this.pending) {
        const same = this.pending.options.key === key && JSON.stringify(this.pending.payload) === JSON.stringify(payload);
        const recovered = await this.submit(this.pending, undefined, generation);
        if (same) { this.generation++; return recovered; }
      }
      if (this.version !== expectedVersion) throw new DocumentSaveError("The document changed. Generate a new proposal.", 412, "DOCUMENT_VERSION_CONFLICT");
      const pending = { payload: JSON.parse(JSON.stringify(payload)), options: { key, expectedVersion }, send };
      this.pending = pending;
      const saved = await this.submit(pending, undefined, generation);
      this.generation++;
      return saved;
    });
    this.tail = work.then(() => undefined, () => undefined);
    return work;
  }
  private async submit(command: NonNullable<DocumentSaveCoordinator["pending"]>, signal: AbortSignal | undefined, generation: number) {
    try {
      const saved = await (command.send ?? this.send)(command.payload, { ...command.options, signal });
      if (generation !== this.generation) throw new DocumentSaveError("Website changed during save", 409, "DOCUMENT_SCOPE_CHANGED");
      this.version = saved.documentVersion; this.pending = null;
      return saved;
    } catch (failure) {
      const error = failure instanceof DocumentSaveError ? failure : new DocumentSaveError("Save outcome is unknown. Retry the same command.", 0, "DOCUMENT_OUTCOME_UNKNOWN", true);
      if (generation === this.generation && !error.outcomeUnknown) {
        this.pending = null;
        if ([401,403,404,409,412,428].includes(error.status)) this.blocked = error;
      }
      throw error;
    }
  }
}
export function createDocumentSaveCoordinator(base: string, websiteId: string) {
  return new DocumentSaveCoordinator((payload,options) => saveAuthorizedWebsite(base,websiteId,payload,options));
}
