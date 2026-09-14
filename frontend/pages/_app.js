import "@/styles/globals.css";
import { ToastProvider } from "../context/ToastContext";
import { SocketProvider } from "../context/SocketContext";
import { ModeProvider } from "../context/ModeContext";
import { useRouter } from "next/router";

import ErrorBoundary from "../components/ErrorBoundary";
import UniversalChatDock from "../components/chat/UniversalChatDock";
import TaskServerCancelBridge from "../components/chat/TaskServerCancelBridge";

export default function App({ Component, pageProps }) {
  const router = useRouter();

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
