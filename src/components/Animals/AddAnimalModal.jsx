
import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';

const AddAnimalModal = ({ isOpen, onClose, onAdd, groups }) => {
  const [tagNumber, setTagNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [group, setGroup] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      tag_number: tagNumber,
      birth_date: birthDate, // Registration Date
      current_weight: weight,
      last_weight_kg: weight,
      purchase_price: purchasePrice,
      group_id: group ? parseInt(group) : null,
    });
    // Reset form
    setTagNumber('');
    setBirthDate('');
    setWeight('');
    setPurchasePrice('');
    setGroup('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Yeni Hayvan Ekle</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Küpe Numarası</label>
              <input
                type="text"
                value={tagNumber}
                onChange={(e) => setTagNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="TR..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kayıt Tarihi</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="gg.aa.yyyy"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Güncel Kilo (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="450"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alış Fiyatı (TL)</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Grup</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Grup Seçiniz (İsteğe Bağlı)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAnimalModal;
