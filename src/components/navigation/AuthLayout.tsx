import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

export default function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClose = () => {
    // If we have a previous page in history, go back
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // If no history or direct navigation, go to home
      navigate('/', { replace: true });
    }
  };

  return (
<div className="min-h-[calc(100vh-4rem)] flex flex-col justify-start py-12 sm:px-6 lg:px-8">
  <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
    <div className="relative bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 
        transform transition-all duration-200 hover:shadow-2xl">
      
      {/* Close Button with Tooltip */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 
                 hover:bg-gray-100 rounded-full transition-colors group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
        
        {/* Tooltip - Appears on hover */}
        <span className="absolute top-12 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white 
                        bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
          Close
        </span>
      </button>

      <Outlet />
    </div>
  </div>
</div>
  );
}