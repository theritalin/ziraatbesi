import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import { supabase } from '../../supabaseClient';

const TodoModal = ({ isOpen, onClose, farmId, preselectedDate, onTaskAdded }) => {
  const [title, setTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTaskDate(preselectedDate || new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen, preselectedDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !taskDate) {
      setError('Lütfen görev başlığı ve tarihini giriniz.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const { data, error: submitError } = await supabase
        .from('todos')
        .insert([{
          farm_id: farmId,
          title: title.trim(),
          task_date: taskDate
        }])
        .select()
        .single();

      if (submitError) throw submitError;

      onTaskAdded(data);
      onClose();
    } catch (err) {
      console.error('Error adding todo:', err);
      setError('Görev eklenirken bir hata oluştu: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Yeni Görev Ekle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX className="text-2xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Görev Açıklaması</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="Örn: Aşıların kontrolü"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
            <input
              type="date"
              required
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                 <FiSave className="mr-2" />
                 Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TodoModal;
