// Hosted runtime. Personal keys are scoped to a single request.
import { createDatevHandler } from '../../../../docker/datev/handler.mjs';
export const dynamic = 'force-dynamic';
const handle = createDatevHandler();
export const GET = (request: Request) => handle(request);
export const POST = (request: Request) => handle(request);
