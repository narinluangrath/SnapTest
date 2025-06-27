import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import TestIdFinder from "./TestIdFinder.tsx";
import NetworkInterceptor from "./NetworkInterceptor.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NetworkInterceptor>
      <TestIdFinder>
        <App />
      </TestIdFinder>
    </NetworkInterceptor>
  </React.StrictMode>,
);
