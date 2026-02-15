import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
	const isPowerPlatformBuild = mode === "power-platform";
	const jsFileName = isPowerPlatformBuild ? "Scripts/Pages/version-previewer.js" : "react-form-builder.js";
	const cssFileName = isPowerPlatformBuild ? "Styles/version-previewer.css" : "react-form-builder.css";

	return {
		plugins: [react()],
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
						if (assetInfo.name === "style.css") {
							return cssFileName;
						}
						return isPowerPlatformBuild ? "assets/[name]-[hash][extname]" : assetInfo.name;
					},
				},
			},
		},
	};
});
