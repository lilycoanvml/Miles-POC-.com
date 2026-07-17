import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Dev-only preview of the reveal flow: `?demo=reveal` (see DevReveal.tsx). Tree-shaken in prod.
const demo = import.meta.env.DEV && new URLSearchParams(location.search).get("demo") === "reveal";

async function root() {
  if (demo) {
    const { DevReveal } = await import("./DevReveal");
    return <DevReveal />;
  }
  return <App />;
}

root().then((node) =>
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{node}</React.StrictMode>
  )
);
