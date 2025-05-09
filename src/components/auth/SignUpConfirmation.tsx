import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SignUpConfirmationProps {
  email: string;
}

export default function SignUpConfirmation({ email }: SignUpConfirmationProps) {
  return (
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="mt-6 text-3xl font-bold text-gray-900">Account Created!</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your account has been successfully created.
        </p>
      </div>

      <div className="rounded-md bg-green-50 p-4">
        <div className="flex">
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              You can now sign in with your email and password
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue to Sign In
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}