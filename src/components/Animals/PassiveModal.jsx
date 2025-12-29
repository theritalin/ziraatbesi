import React, { useState } from 'react';
import { FiCalendar, FiAlertCircle } from 'react-icons/fi';

const PassiveModal = ({ isOpen, onClose, onConfirm, animal }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(animal, date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center mb-4 text-orange-600">
          <FiAlertCircle className="w-6 h-6 mr-2" />
          <h2 className="text-xl font-bold">Hayvanı Pasife Al</h2>
        </div>

        <p className="text-gray-600 mb-6">
          <span className="font-semibold">{animal?.tag_number}</span> küpe numaralı hayvanı pasife almak üzeresiniz.
          Bu işlemden sonra hayvan, seçilen tarihten itibaren rasyon ve maliyet hesaplamalarından düşülecektir.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Pasif Olma Tarihi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiCalendar className="text-gray-400" />
              </div>
              <input
                type="date"
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Bu tarihten sonraki günler için hesaplama yapılmaz.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
            >
              Pasife Al
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassiveModal;
