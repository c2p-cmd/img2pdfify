import { useState } from 'react';
import ImageToPdf from './components/ImageToPdf';
import MergePdf from './components/MergePdf';
import './components/styles.css';

function App() {
  const [activeTab, setActiveTab] = useState<'images' | 'merge'>('images');

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="app-kicker">fast local tools</p>
          <h1>PDF Studio</h1>
        </div>
        <p className="app-summary">
          Convert images into PDFs or merge files in a clean little workspace that works on desktop and mobile.
        </p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Images to PDF
        </button>
        <button
          className={`tab-btn ${activeTab === 'merge' ? 'active' : ''}`}
          onClick={() => setActiveTab('merge')}
        >
          Merge PDFs
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'images' && <ImageToPdf />}
        {activeTab === 'merge' && <MergePdf />}
      </div>
    </div>
  );
}

export default App;
