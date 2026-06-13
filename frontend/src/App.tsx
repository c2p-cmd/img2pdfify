import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { routeList } from "./lib/routeMeta";
import "./components/styles.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="app-kicker">fast local tools</p>
          <h1>PDFify</h1>
        </div>
        <p className="app-summary">
          Convert images, merge, split, or unlock your PDFs in a clean,
          private workspace.
        </p>
      </header>

      <nav
        className="tab-navigation"
        aria-label="PDF tools"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
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

      <div className="tab-content">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

export default App;
