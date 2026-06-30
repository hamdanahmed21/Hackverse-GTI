import { createRoot } from "react-dom/client";
import "../../styles/globals.css";
import App from "./App.jsx";

const container = document.getElementById("root");

if (!container) {
  throw new Error("[main.jsx] #root element not found in index.html.");
}

createRoot(container).render(<App />);