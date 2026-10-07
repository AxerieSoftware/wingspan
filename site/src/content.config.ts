import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		// Feature pages: `introduced` is the Wingspan version the feature first shipped in, and `plus` marks features that
		// need Monarch's Plus plan. Both show as badges under the page title.
		schema: docsSchema({ extend: z.object({ introduced: z.string().optional(), plus: z.boolean().optional() }) }),
	}),
};
