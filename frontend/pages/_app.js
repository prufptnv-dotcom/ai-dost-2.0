import "@/styles/globals.css";
import { ToastProvider } from "../context/ToastContext";
import { SocketProvider } from "../context/SocketContext";
import { ModeProvider } from "../context/ModeContext";

export default function App({ Component, pageProps }) {
  return (
    <ToastProvider>
      <SocketProvider>
        <ModeProvider>
          <Component {...pageProps} />
        </ModeProvider>
      </SocketProvider>
    </ToastProvider>
  );
}
