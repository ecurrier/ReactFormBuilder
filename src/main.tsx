import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";

async function enableMocking() {
	// @ts-ignore
	if (import.meta.env && import.meta.env.DEV) {
		/* Import Bootstrap in dev to simulate Power Pages environment
			This project doesn't use Bootstrap, but Power Pages does and it includes it automatically
			so this helps catch any conflicts early
		*/
		await import("bootstrap/dist/js/bootstrap.bundle.min.js" as any);
		await import("bootstrap/dist/css/bootstrap.min.css" as any);
		// Import custom styles AFTER Bootstrap to ensure they take precedence
		await import("@public/styles/styles.css");

		const { worker } = await import("@testing/mocks/browser");
		await worker.start({
			onUnhandledRequest: "bypass",
		});
	}
}

enableMocking().then(() => {
	if (!import.meta.env.DEV) {
		import("@public/styles/styles.css");
	}

	ReactDOM.createRoot(document.getElementById("root")).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
});
