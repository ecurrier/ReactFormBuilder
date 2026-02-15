import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite plugin that rewrites CSS references in __vite__mapDeps to use
 * the absolute Power Platform Web Resource path, bypassing the base prefix.
 *
 * Vite prepends the base path ("/WebResources/eyfrcc_/") to deps at runtime,
 * producing "/WebResources/eyfrcc_/Styles/version-previewer.css". But the actual
 * web resource URL is "/WebResources/eyfrcc_Styles/version-previewer.css" (no slash
 * between the prefix and "Styles"). This plugin injects the correct absolute path.
 */
function powerPlatformCssPathPlugin() {
	const absoluteCssPath = "/WebResources/eyfrcc_Styles/version-previewer.css";
	return {
		name: "power-platform-css-path",
		enforce: "post",
		generateBundle(_, bundle) {
			for (const [fileName, chunk] of Object.entries(bundle)) {
				if (chunk.type === "chunk" && fileName.endsWith(".js")) {
					// Match the m.f=["...css..."] pattern inside __vite__mapDeps
					chunk.code = chunk.code.replace(
						/(m\.f\|\|\(m\.f=\[)([^\]]+)(\]\)\))/,
						(match, before, deps, after) => {
							const rewritten = deps.replace(
								/["'][^"']*\.css["']/g,
								`"${absoluteCssPath}"`,
							);
							return before + rewritten + after;
						},
					);
				}
			}
		},
	};
}

export default defineConfig(({ mode }) => {
	const isPowerPlatformBuild = mode === "power-platform";
	const jsFileName = isPowerPlatformBuild ? "Scripts/Pages/version-previewer.js" : "react-form-builder.js";
	const cssFileName = isPowerPlatformBuild ? "Styles/version-previewer.css" : "react-form-builder.css";

	return {
		plugins: [react(), ...(isPowerPlatformBuild ? [powerPlatformCssPathPlugin()] : [])],
		base: isPowerPlatformBuild ? "/WebResources/eyfrcc_/" : "./",
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				"@api": path.resolve(__dirname, "./src/services/api"),
				"@app-types": path.resolve(__dirname, "./src/types"),
				"@utilities": path.resolve(__dirname, "./src/utilities"),
				"@components": path.resolve(__dirname, "./src/components"),
				"@hooks": path.resolve(__dirname, "./src/hooks"),
				"@constants": path.resolve(__dirname, "./src/constants"),
				"@services": path.resolve(__dirname, "./src/services"),
				"@testing": path.resolve(__dirname, "./src/testing"),
				"@public": path.resolve(__dirname, "./public"),
			},
		},
		build: {
			outDir: isPowerPlatformBuild ? "dist-power-platform" : "dist",
			assetsInlineLimit: isPowerPlatformBuild ? 0 : undefined,
			rollupOptions: {
				output: {
					entryFileNames: jsFileName,
					chunkFileNames: isPowerPlatformBuild ? "Scripts/Pages/[name]-[hash].js" : "react-form-builder.js",
					assetFileNames: (assetInfo) => {
						if (assetInfo.name?.endsWith(".css")) {
							return cssFileName;
						}
						return isPowerPlatformBuild ? "assets/[name]-[hash][extname]" : assetInfo.name;
					},
				},
			},
		},
	};
});
