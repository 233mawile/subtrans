import handler from "../dist/vercel/index.mjs";

export function GET(request) {
  return handler.fetch(request);
}
