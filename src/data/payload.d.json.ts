// Types for payload.json, so TypeScript doesn't infer 2 MB of literal types.
import type { Payload } from '../lib/types.ts';

declare const payload: Payload;
export default payload;
