import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../sidepanel/styles/sidepanel.css";
import "./mic-permission.css";
import { MicPermissionPage } from "./MicPermissionPage";

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <MicPermissionPage />
    </StrictMode>,
  );
}