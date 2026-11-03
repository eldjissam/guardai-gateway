import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatSessionProvider } from "./contexts/ChatSessionContext";
import "./styles.css";
import "./auth-fixes.css";
import "./auth-status.css";
import "./secure-chat.css";
import "./secure-chat-quality.css";
import "./history-management.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ChatSessionProvider>
        <App />
      </ChatSessionProvider>
    </AuthProvider>
  </React.StrictMode>,
);
