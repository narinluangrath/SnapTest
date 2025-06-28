import React from "react";
import ReactDOM from "react-dom/client";
import MockPokemonApp from "./App.tsx";
import { NetworkInterceptor, TestIdFinder } from "./TestGenerator.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NetworkInterceptor>
      <TestIdFinder>
        <MockPokemonApp />
      </TestIdFinder>
    </NetworkInterceptor>
  </React.StrictMode>,
);
