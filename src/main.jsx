import React from "react";
import { createRoot } from "react-dom/client";
import InvitationEntry from "./InvitationEntry";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InvitationEntry />
  </React.StrictMode>,
);
