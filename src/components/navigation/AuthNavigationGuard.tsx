@@ .. @@
       // If we're landing *and* authenticated, jump straight into the flow
       if (authenticated && location.pathname === '/') {
        // No need to navigate since '/' is now the intake screen
+        navigate('/decision/intake', { replace: true });
         return;
       }
@@ .. @@
     // If on an auth page but already signed in, send them to the flow
     if (isAuthRoute && authenticated) {
      navigate('/', { replace: true });
+      navigate('/decision/intake', { replace: true });
       return;
     }
@@ .. @@
     // Public landing page: if you're already authed, bounce to /decision
     if (location.pathname === '/' && authenticated) {
      // No need to navigate since '/' is now the intake screen
+      navigate('/decision/intake', { replace: true });
     }
   }, [authenticated, loading, location.pathname, navigate]);