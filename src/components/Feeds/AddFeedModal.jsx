import React, { useState } from 'react';
import Input from '../Auth/Input';

const AddFeedModal = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const stockValue = parseFloat(stock);
    onAdd({
      name,
      current_stock_kg: stockValue,
      initial_stock_kg: stockValue, // Set initial = current on first add
      price_per_kg: parseFloat(price),
    });
    // Reset form
    setName('');
    setStock('');
    setPrice('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6">Yeni Yem Ekle</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input 
              label="Yem Adı" 
              placeholder="Örn: Arpa Ezmesi" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input 
              label="Stok Miktarı (kg)" 
              type="number" 
              placeholder="1000" 
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <Input 
              label="Birim Fiyat (TL/kg)" 
              type="number" 
              placeholder="5.5" 
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex justify-end mt-8">
            <button
              type="button"
              onClick={onClose}
              className="mr-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              İptal
            </button>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFeedModal;
