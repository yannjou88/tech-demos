import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache: the page is static and the Workers free plan
// should not need a paid binding.
export default defineCloudflareConfig();
