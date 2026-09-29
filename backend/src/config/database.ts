// Compatibility import; there is one bounded pool per runtime, not a second
// unbounded identity pool. Schema and account changes never occur during import.
export { prisma, pgPool } from "./prisma.js";
