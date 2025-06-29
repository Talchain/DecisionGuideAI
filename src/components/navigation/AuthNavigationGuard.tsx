@@ .. @@
       // If we're landing *and* authenticated, jump straight into the flow
       if (authenticated && location.pathname === '/') {
-        navigate('/decision', { replace: true });
+        navigate('/decision/intake', { replace: true });
         return;
       }
@@ .. @@
     // If on an auth page but already signed in, send them to the flow
     if (isAuthRoute && authenticated) {
-      navigate('/decision', { replace: true });
+      navigate('/decision/intake', { replace: true });
       return;
     }
@@ .. @@
     // Public landing page: if you're already authed, bounce to /decision
     if (location.pathname === '/' && authenticated) {
-      navigate('/decision', { replace: true });
+      navigate('/decision/intake', { replace: true });
     }
   }, [authenticated, loading, location.pathname, navigate]);