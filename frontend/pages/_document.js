import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AI-Dost" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var dummyComponents = new Proxy({}, {
      get: function(t, p) { return t[p] || { Component: function() { return null; } }; }
    });
    var dummyRouter = { components: dummyComponents, pathname: '/' };
    var _next = window.next || {};
    var _router = _next.router || dummyRouter;
    if (!_router.components) _router.components = dummyComponents;

    function attachRouterGuard(target) {
      if (!target) return;
      try {
        Object.defineProperty(target, 'router', {
          configurable: true,
          enumerable: true,
          get: function() {
            if (!_router.components) _router.components = dummyComponents;
            return _router;
          },
          set: function(r) {
            _router = r || dummyRouter;
            if (!_router.components) _router.components = dummyComponents;
          }
        });
      } catch (_) {
        target.router = _router;
      }
    }

    attachRouterGuard(_next);

    try {
      Object.defineProperty(window, 'next', {
        configurable: true,
        enumerable: true,
        get: function() {
          if (!_next.router) attachRouterGuard(_next);
          return _next;
        },
        set: function(n) {
          _next = n || {};
          attachRouterGuard(_next);
        }
      });
    } catch (_) {
      window.next = _next;
    }

    window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
    window.__NEXT_DATA__.components = window.__NEXT_DATA__.components || dummyComponents;
  } catch (_) {}
})();
`
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
