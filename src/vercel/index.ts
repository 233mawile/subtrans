import { handleWorkerRequest } from "../cloudflareWorker/index.ts";

// The upstream subscription often lives on a bare IP with a self-signed
// certificate, so TLS verification is disabled for this Node deployment.
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

export default {
  fetch(request: Request): Promise<Response> {
    return handleWorkerRequest(request, {});
  },
};
