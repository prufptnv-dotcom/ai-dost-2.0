import "@/styles/globals.css";
import { ToastProvider } from "../context/ToastContext";
import { SocketProvider } from "../context/SocketContext";
import { ModeProvider } from "../context/ModeContext";
import { useRouter } from "next/router";

import ErrorBoundary from "../components/ErrorBoundary";
import UniversalChatDock from "../components/chat/UniversalChatDock";
import TaskServerCancelBridge from "../components/chat/TaskServerCancelBridge";

import { useEffect } from "react";

// Safeguard against Next.js 16 hot-reloader-pages handleStaticIndicator TypeError
if (typeof window !== 'undefined') {
  try {
    const dummyComponents = new Proxy({}, {
      get: (target, prop) => target[prop] || { Component: () => null }
    });
    window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
    if (!window.__NEXT_DATA__.components) {
      window.__NEXT_DATA__.components = dummyComponents;
    }
    window.next = window.next || {};
    if (!window.next.router) {
      window.next.router = { components: dummyComponents, pathname: window.location?.pathname || '/' };
    } else if (!window.next.router.components) {
      window.next.router.components = dummyComponents;
    }
  } catch (_) {}
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // P3 #196: next-pwa is force-disabled (next.config.mjs) and a repo-wide
  // grep found zero navigator.serviceWorker.register calls — public/sw.js was
  // never installed while _document.js still linked manifest.json (install
  // prompt with no offline worker). Register the hand-written worker here,
  // production only (dev caching just confuses debugging).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Global robust copy guard: guarantees Ctrl+C / Cmd+C copies any selected text to clipboard
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
        // 1. Check window selection
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString() : '';
        if (selectedText && selectedText.length > 0) {
          try {
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(selectedText);
              // P3 #115: we handled this copy ourselves — stop the native
              // copy path so writeText isn't fired twice (racy double copy).
              e.preventDefault();
              e.stopPropagation();
            }
          } catch (_) {}
          return;
        }

        // 2. Check active input/textarea selection
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          const start = active.selectionStart;
          const end = active.selectionEnd;
          if (typeof start === 'number' && typeof end === 'number' && start !== end) {
            const inputSel = active.value.substring(start, end);
            if (inputSel) {
              try {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(inputSel);
                  // P3 #115: same — we own this copy; suppress the native one.
                  e.preventDefault();
                  e.stopPropagation();
                }
              } catch (_) {}
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <SocketProvider>
          <ModeProvider>
            <Component {...pageProps} />
            {router.pathname === '/dashboard' && (
              <>
                <UniversalChatDock />
                <TaskServerCancelBridge />
              </>
            )}
          </ModeProvider>
        </SocketProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
