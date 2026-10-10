import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";
import { installTheme } from "./theme/Colour.ts";
import "./index.css";

installTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
