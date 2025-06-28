import React from "react";
import ReactDOM from "react-dom/client";
import MockUserApp from "./App.tsx";
import { SnapTestProvider } from "./SnapTest.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SnapTestProvider>
      <MockUserApp />
    </SnapTestProvider>
  </React.StrictMode>,
);
