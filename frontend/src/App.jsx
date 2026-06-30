import { useState, useEffect, useRef, useCallback } from "react";
import { useCursor } from "./hooks/useCursor";
import Home from "./pages/Home.jsx";
import Session from "./pages/Session.jsx";

function PageFlash() {
  const flashRef = useRef(null);
  useEffect(() => {
    const el = flashRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (document.body.dataset.alert === "active") {
        el.classList.remove("firing");
        void el.offsetWidth;
        el.classList.add("firing");
      } else {
        el.classList.remove("firing");
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-alert"],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="page-flash"
      ref={flashRef}
      aria-hidden="true"
    />
  );
}

export default function App() {
  useCursor();
  const [page, setPage] = useState("home");

  const handleEnterSession = useCallback(() => {
    setPage("session");
  }, []);

  const handleGoHome = useCallback(() => {
    setPage("home");
  }, []);

  return (
    <>
      <PageFlash />
      {page === "home" ? (
        <Home onEnterSession={handleEnterSession} />
      ) : (
        <Session onGoHome={handleGoHome} />
      )}
    </>
  );
}