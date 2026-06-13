import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.tsx";
import PageMeta from "./components/PageMeta.tsx";
import { routes } from "./lib/routeMeta";
import "./index.css";

const ImageToPdf = lazy(() => import("./components/ImageToPdf"));
const MergePdf = lazy(() => import("./components/MergePdf"));
const SplitPdf = lazy(() => import("./components/SplitPdf"));
const UnlockPdf = lazy(() => import("./components/UnlockPdf"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/img2pdfify">
      <Routes>
        <Route element={<App />}>
          <Route
            index
            element={
              <>
                <PageMeta {...routes.images} />
                <ImageToPdf />
              </>
            }
          />
          <Route
            path="merge"
            element={
              <>
                <PageMeta {...routes.merge} />
                <MergePdf />
              </>
            }
          />
          <Route
            path="split"
            element={
              <>
                <PageMeta {...routes.split} />
                <SplitPdf />
              </>
            }
          />
          <Route
            path="unlock"
            element={
              <>
                <PageMeta {...routes.unlock} />
                <UnlockPdf />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
