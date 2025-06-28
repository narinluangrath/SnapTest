import React from "react";
import ReactDOM from "react-dom/client";
import MockUserApp from "./App.tsx";
import { TestGeneratorProvider } from "./TestGenerator.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TestGeneratorProvider>
      <MockUserApp />
    </TestGeneratorProvider>
  </React.StrictMode>,
);
