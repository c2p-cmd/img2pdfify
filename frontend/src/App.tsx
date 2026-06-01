import { useState, Suspense, lazy } from "react";

// Lazy-load each tab so its chunk (and heavy deps like pdfjs-dist) is only
// fetched when the user first visits that tab — not on initial page load.
const ImageToPdf = lazy(() => import("./components/ImageToPdf"));
const MergePdf   = lazy(() => import("./components/MergePdf"));
const SplitPdf   = lazy(() => import("./components/SplitPdf"));
const UnlockPdf  = lazy(() => import("./components/UnlockPdf"));
const ChatPdf    = lazy(() => import("./components/ChatPdf"));
import "./components/styles.css";

function App() {
  const [activeTab, setActiveTab] = useState<"images" | "merge" | "split" | "unlock" | "chat">(
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
          Convert images, merge, split, or unlock your PDFs in a clean,
          private workspace.
        </p>
      </header>

      <div className="tab-navigation" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
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
        <button
          id="tab-unlock"
          className={`tab-btn ${activeTab === "unlock" ? "active" : ""}`}
          onClick={() => setActiveTab("unlock")}
        >
          Lock / Unlock
        </button>
        {/* <button
          className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat with PDF
        </button> */}
      </div>

      <div className="tab-content">
        <Suspense fallback={null}>
          {activeTab === "images" && <ImageToPdf />}
          {activeTab === "merge"  && <MergePdf />}
          {activeTab === "split"  && <SplitPdf />}
          {activeTab === "unlock" && <UnlockPdf />}
          {activeTab === "chat"   && <ChatPdf />}
        </Suspense>
      </div>
    </div>
  );
}

export default App;
