import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded shadow-lg p-6 min-w-[320px] max-w-[90vw]">
        {title && <h2 className="text-lg font-bold mb-2">{title}</h2>}
        <div className="mb-4">{message}</div>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={onCancel} aria-label="Cancel">Cancel</button>
          <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={onConfirm} aria-label="Confirm delete">Delete</button>
        </div>
      </div>
    </div>
  );
};
