import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/sidepanel.css";

document.documentElement.dataset.uiMode = "normal";
document.documentElement.dataset.modeReady = "false";

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}