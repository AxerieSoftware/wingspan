import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		// Feature pages: `introduced` is the Wingspan version the feature first shipped in, `plus` marks features that
		// need Monarch's Plus plan, and `saves` is where the feature keeps what you set. All show as badges under the page title.
		schema: docsSchema({ extend: z.object({ introduced: z.string().optional(), plus: z.boolean().optional(), saves: z.enum(["account", "browser"]).optional() }) }),
	}),
};
