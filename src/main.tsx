import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/styles.css";

async function enableMocking() {
	// @ts-ignore
	if (import.meta.env && import.meta.env.DEV) {
		/* Import Bootstrap in dev to simulate Power Pages environment
			This project doesn't use Bootstrap, but Power Pages does and it includes it automatically
			so this helps catch any conflicts early
		*/
		await import("bootstrap/dist/js/bootstrap.bundle.min.js" as any);
		const { worker } = await import("@mocks/browser");
		await worker.start({
			onUnhandledRequest: "bypass",
		});
	}
}

enableMocking().then(() => {
	ReactDOM.createRoot(document.getElementById("root")).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
});
