import "@/styles/globals.css";
import { ToastProvider } from "../context/ToastContext";
import { SocketProvider } from "../context/SocketContext";
import { ModeProvider } from "../context/ModeContext";

import ErrorBoundary from "../components/ErrorBoundary";

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SocketProvider>
          <ModeProvider>
            <Component {...pageProps} />
          </ModeProvider>
        </SocketProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
