import React from "react";
import ReactDOM from "react-dom/client";
import MockUserApp from "./App.tsx";
import { NetworkInterceptor, TestIdFinder } from "./TestGenerator.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NetworkInterceptor>
      <TestIdFinder>
        <MockUserApp />
      </TestIdFinder>
    </NetworkInterceptor>
  </React.StrictMode>,
);
