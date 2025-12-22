import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

async function enableMocking() {
	// @ts-ignore
	if (import.meta.env && import.meta.env.DEV) {
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
