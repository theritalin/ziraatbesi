import React, { useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? <FiCheckCircle className="text-xl" /> : <FiAlertCircle className="text-xl" />;

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50 animate-fade-in-up`}>
      {icon}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 hover:bg-white hover:bg-opacity-20 rounded-full p-1">
        <FiX />
      </button>
    </div>
  );
};

export default Toast;
