import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@api": path.resolve(__dirname, "./src/services/api"),
			"@types": path.resolve(__dirname, "./src/types"),
			"@utilities": path.resolve(__dirname, "./src/utilities"),
			"@components": path.resolve(__dirname, "./src/components"),
			"@hooks": path.resolve(__dirname, "./src/hooks"),
			"@constants": path.resolve(__dirname, "./src/constants"),
			"@services": path.resolve(__dirname, "./src/services"),
			"@testing": path.resolve(__dirname, "./src/testing"),
		},
	},
	build: {
		rollupOptions: {
			output: {
				entryFileNames: "react-form-builder.js",
				chunkFileNames: "react-form-builder.js",
				assetFileNames: (assetInfo) => {
					if (assetInfo.name === "style.css") {
						return "react-form-builder.css";
					}
					return assetInfo.name;
				},
			},
		},
	},
});
