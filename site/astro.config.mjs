import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const repo = "https://github.com/AxerieSoftware/wingspan";

export default defineConfig({
	site: "https://wingspan.axerie.com",
	integrations: [
		starlight({
			title: "Wingspan",
			description: "A browser extension that adds what Monarch Money doesn't have yet, inside Monarch's own pages.",
			logo: { light: "./src/assets/wordmark.svg", dark: "./src/assets/wordmark-dark.svg", alt: "Wingspan", replacesTitle: true },
			favicon: "/favicon.svg",
			social: [{ icon: "github", label: "GitHub", href: repo }],
			editLink: { baseUrl: `${repo}/edit/main/site/` },
			customCss: ["./src/styles/global.css"],
			components: { Footer: "./src/components/Footer.astro", PageTitle: "./src/components/PageTitle.astro" },
			sidebar: [
				{ label: "Quick start", slug: "quick-start" },
				{
					label: "Features",
					items: [
						{ label: "Overview", slug: "features" },
						{ label: "Due dates", slug: "features/due-dates" },
						{ label: "Manual bills", slug: "features/manual-bills" },
						{ label: "Card payments", slug: "features/card-payments" },
						{ label: "Projected balances", slug: "features/projected-balances" },
						{ label: "Retail receipt sync", slug: "features/receipt-sync" },
						{ label: "Workspaces", slug: "features/workspaces" },
					],
				},
				{
					label: "Plans",
					items: [
						{ label: "Roadmap", link: "/roadmap/" },
						{ label: "Feature requests", link: "https://github.com/AxerieSoftware/wingspan/discussions/categories/ideas", attrs: { target: "_blank" } },
					],
				},
				{
					label: "About",
					items: [
						{ label: "Where Wingspan saves", slug: "features/where-wingspan-saves" },
						{ label: "Privacy", slug: "privacy" },
						{ label: "How it works", slug: "how-it-works" },
					],
				},
				{
					label: "Monarch",
					items: [
						{ label: "About Monarch", link: "/monarch/" },
						{ label: "What r/MonarchMoney asks for", link: "/reddit/" },
					],
				},
			],
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
