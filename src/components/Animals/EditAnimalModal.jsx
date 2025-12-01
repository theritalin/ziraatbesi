import React, { useState, useEffect } from 'react';
import Input from '../Auth/Input';

const EditAnimalModal = ({ isOpen, onClose, onUpdate, animal }) => {
  const [tagNumber, setTagNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [group, setGroup] = useState('');

  useEffect(() => {
    if (animal) {
      setTagNumber(animal.tag_number);
      setBirthDate(animal.birth_date);
      setWeight(animal.current_weight);
      setGroup(animal.group);
    }
  }, [animal]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate({
      ...animal,
      tag_number: tagNumber,
      birth_date: birthDate,
      current_weight: weight,
      group: group,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6">Hayvanı Düzenle</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Küpe Numarası" 
              placeholder="TR..." 
              value={tagNumber}
              onChange={(e) => setTagNumber(e.target.value)}
            />
            <Input 
              label="Doğum Tarihi" 
              type="date" 
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <Input 
              label="Güncel Kilo (kg)" 
              type="number" 
              placeholder="450" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <Input 
              label="Grup" 
              placeholder="Besi Grubu 1" 
              value={group}
              onChange={(e) => setGroup(e.target.value)}
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
              Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAnimalModal;
