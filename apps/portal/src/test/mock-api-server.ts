/**
 * PHASE B1.3 — Portal Test Foundation: MSW-backed fake API server.
 *
 * Intercepts at the network layer (real `fetch` calls made by
 * apiRequest()/react-query never leave the process) — no production API is
 * ever reached from a portal test. Default handlers cover the minimum every
 * page needs to render past its initial loading state; individual tests
 * override with `mockApiServer.use(...)` for page-specific responses.
 */
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiSuccessFixture, createRoleFixture } from "./fixtures";

const defaultHandlers = [
  http.get("/api/auth/me", () => HttpResponse.json(createApiSuccessFixture(createRoleFixture("admin")))),
  // Foundation-level fallback: most pages fan out to a dozen+ GET endpoints
  // for dashboard widgets that aren't the point of a smoke test (proving
  // the page renders past its loading state, not exercising every widget's
  // data). Matched last (MSW tries handlers in registration order), so any
  // handler registered via mockApiServer.use() in a specific test still
  // takes priority over this generic empty-list/empty-object response.
  http.get("/api/*", () => HttpResponse.json(createApiSuccessFixture([]))),
];

export const mockApiServer = setupServer(...defaultHandlers);

export { http, HttpResponse };
