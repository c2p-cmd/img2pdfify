import { useState } from "react";
import ImageToPdf from "./components/ImageToPdf";
import MergePdf from "./components/MergePdf";
import ChatPdf from "./components/ChatPdf";
import "./components/styles.css";

function App() {
  const [activeTab, setActiveTab] = useState<"images" | "merge" | "chat">(
    "images",
  );

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="app-kicker">fast local tools</p>
          <h1>PDF Studio</h1>
        </div>
        <p className="app-summary">
          Convert images, merge files, or chat with your PDFs in a clean,
          private workspace.
        </p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === "images" ? "active" : ""}`}
          onClick={() => setActiveTab("images")}
        >
          Images to PDF
        </button>
        <button
          className={`tab-btn ${activeTab === "merge" ? "active" : ""}`}
          onClick={() => setActiveTab("merge")}
        >
          Merge PDFs
        </button>
        {/* <button
          className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat with PDF
        </button> */}
      </div>

      <div className="tab-content">
        {activeTab === "images" && <ImageToPdf />}
        {activeTab === "merge" && <MergePdf />}
        {activeTab === "chat" && <ChatPdf />}
      </div>
    </div>
  );
}

export default App;
