import { useState } from "react";
import ImageToPdf from "./components/ImageToPdf";
import MergePdf from "./components/MergePdf";
import SplitPdf from "./components/SplitPdf";
import ChatPdf from "./components/ChatPdf";
import "./components/styles.css";

function App() {
  const [activeTab, setActiveTab] = useState<"images" | "merge" | "split" | "chat">(
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

      <div className="tab-navigation" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <button
          id="tab-images"
          className={`tab-btn ${activeTab === "images" ? "active" : ""}`}
          onClick={() => setActiveTab("images")}
        >
          Images to PDF
        </button>
        <button
          id="tab-merge"
          className={`tab-btn ${activeTab === "merge" ? "active" : ""}`}
          onClick={() => setActiveTab("merge")}
        >
          Merge PDFs
        </button>
        <button
          id="tab-split"
          className={`tab-btn ${activeTab === "split" ? "active" : ""}`}
          onClick={() => setActiveTab("split")}
        >
          Split PDF
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
        {activeTab === "split" && <SplitPdf />}
        {activeTab === "chat" && <ChatPdf />}
      </div>
    </div>
  );
}

export default App;
