import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { routeList } from "./lib/routeMeta";
import "./components/styles.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>PDFify</h1>
        </div>
        <p className="app-summary">
          Convert images, merge, split, lock or unlock PDFs. Your files stay
          on your device.
        </p>
      </header>

      <nav
        className="tab-navigation"
        aria-label="PDF tools"
      >
        {routeList.map((route) => (
          <NavLink
            key={route.path}
            id={route.tabId}
            to={route.path}
            end={route.path === "/"}
            className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
          >
            {route.navLabel}
          </NavLink>
        ))}
      </nav>

      <main className="tab-content">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default App;
