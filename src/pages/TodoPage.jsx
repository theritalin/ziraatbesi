import React, { useState, useEffect } from 'react';
import { FiPlus, FiChevronLeft, FiChevronRight, FiCheckCircle, FiCircle, FiTrash2 } from 'react-icons/fi';
import { supabase } from '../supabaseClient';
import { useFarmId } from '../hooks/useFarmId';
import TodoModal from '../components/Todo/TodoModal';

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekDates = (startDate) => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const formatDateForDB = (date) => {
    // Ensures YYYY-MM-DD
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TodoPage = () => {
  const { farmId } = useFarmId();
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForNew, setSelectedDateForNew] = useState(null);
  const [selectedDate, setSelectedDate] = useState(formatDateForDB(new Date()));

  const fetchTodos = async (startDate) => {
    if (!farmId) return;
    setIsLoading(true);
    try {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const startStr = formatDateForDB(startDate);
      const endStr = formatDateForDB(endDate);

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('farm_id', farmId)
        .gte('task_date', startStr)
        .lte('task_date', endStr)
        .order('task_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos(currentWeekStart);
  }, [farmId, currentWeekStart]);

  const handlePreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const toggleTodoCompletion = async (todo) => {
    try {
      const newStatus = !todo.is_completed;
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_completed: newStatus } : t));

      const { error } = await supabase
        .from('todos')
        .update({ is_completed: newStatus })
        .eq('id', todo.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling todo:', error);
      fetchTodos(currentWeekStart);
    }
  };

  const deleteTodo = async (id) => {
      if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
      try {
          setTodos(prev => prev.filter(t => t.id !== id));
          
          const { error } = await supabase
              .from('todos')
              .delete()
              .eq('id', id);
              
          if (error) throw error;
      } catch (error) {
          console.error('Error deleting todo:', error);
          fetchTodos(currentWeekStart);
      }
  };

  const openModalForDate = (dateStr) => {
    setSelectedDateForNew(dateStr);
    setIsModalOpen(true);
  };

  const handleTaskAdded = (newTodo) => {
      setTodos(prev => [...prev, newTodo].sort((a,b) => new Date(a.task_date) - new Date(b.task_date)));
  };

  const weekDates = getWeekDates(currentWeekStart);
  
  const getShortDayName = (date) => {
      const days = ['PAZ', 'PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT'];
      return days[date.getDay()];
  };

  const selectedDayTodos = todos.filter(t => t.task_date === selectedDate);
  const selectedDateObj = new Date(selectedDate);
  const isTodaySelected = formatDateForDB(new Date()) === selectedDate;

  return (
    <div className="flex flex-col h-full bg-gray-50 max-w-lg mx-auto md:max-w-4xl relative pb-20 md:pb-0 font-sans">
      
      {/* Header & Date Selector */}
      <div className="bg-[#f8f9fa] px-4 pt-8 pb-4 z-10 sticky top-0 md:static">
          <div className="flex justify-between items-center mb-8">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">
                  {currentWeekStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
              </h1>
              <div className="flex space-x-1">
                  <button onClick={handlePreviousWeek} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                      <FiChevronLeft className="text-lg text-gray-800" />
                  </button>
                  <button onClick={handleNextWeek} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                      <FiChevronRight className="text-lg text-gray-800" />
                  </button>
              </div>
          </div>

          {/* Horizontal Calendar */}
          <div className="flex justify-between items-center overflow-x-auto no-scrollbar gap-1 pb-2">
              {weekDates.map((date) => {
                  const dateStr = formatDateForDB(date);
                  const isSelected = dateStr === selectedDate;
                  const isToday = formatDateForDB(new Date()) === dateStr;
                  return (
                      <button
                          key={dateStr}
                          onClick={() => {
                              setSelectedDate(dateStr);
                              const element = document.getElementById(`day-${dateStr}`);
                              if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                          }}
                          className={`flex flex-col items-center justify-center min-w-[3.5rem] md:min-w-[4.5rem] py-3 rounded-2xl transition-all ${
                              isSelected 
                                ? 'bg-[#1ed760] text-white shadow-lg shadow-green-200/50 transform scale-105' 
                                : 'bg-transparent text-gray-500 hover:bg-gray-200/50'
                          }`}
                      >
                          <span className={`text-[10px] font-bold tracking-widest mb-1.5 ${isSelected ? 'text-green-50' : 'text-gray-400'}`}>
                              {getShortDayName(date)}
                          </span>
                          <span className={`text-xl font-bold ${isToday && !isSelected ? 'text-gray-800' : isSelected ? 'text-white' : 'text-gray-500'}`}>
                              {date.getDate()}
                          </span>
                      </button>
                  );
              })}
          </div>
      </div>

      {/* Task List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-8 scroll-smooth" id="task-list-container">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : (
              weekDates.map(date => {
                  const dateStr = formatDateForDB(date);
                  const dayTodos = todos.filter(t => t.task_date === dateStr);
                  const isToday = formatDateForDB(new Date()) === dateStr;

                  return (
                      <div key={dateStr} id={`day-${dateStr}`} className="space-y-4">
                          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest sticky top-0 bg-gray-50 py-2 z-10 border-b border-gray-100 flex items-center justify-between">
                              {isToday ? 'BUGÜN YAPILACAKLAR' : `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} GÖREVLERİ`}
                              <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">{dayTodos.length}</span>
                          </h2>

                          {dayTodos.length === 0 ? (
                              <div className="flex items-center text-gray-400 italic text-sm py-3 px-4 bg-gray-100/50 rounded-2xl border border-dashed border-gray-200">
                                  <FiCheckCircle className="mr-2" />
                                  Bu güne planlanmış görev yok.
                              </div>
                          ) : (
                              dayTodos.map(todo => (
                                  <div 
                                    key={todo.id} 
                                    className={`group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4 transition-all duration-300 ease-in-out hover:shadow-md ${todo.is_completed ? 'opacity-70 bg-gray-50' : ''}`}
                                  >
                                      <button 
                                        onClick={() => toggleTodoCompletion(todo)}
                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-all relative ${
                                            todo.is_completed 
                                                ? 'bg-green-500 text-white' 
                                                : 'bg-white border-2 border-blue-400 hover:border-blue-500'
                                        }`}
                                      >
                                          {todo.is_completed && <FiCheckCircle className="text-white text-xl" />}
                                          {!todo.is_completed && <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 transition-transform transform scale-0 group-hover:scale-100"></div>}
                                      </button>
                                      
                                      <div className="flex-1 min-w-0">
                                          <h3 className={`text-base font-semibold text-gray-800 mb-1 leading-snug ${todo.is_completed ? 'line-through text-gray-400' : ''}`}>
                                              {todo.title}
                                          </h3>
                                          <div className="flex items-center text-xs text-gray-500 gap-3 mt-1.5">
                                              <span className="flex items-center font-medium">
                                                  <FiCircle className="mr-1.5 text-[10px] text-gray-400" />
                                                  Tüm gün
                                              </span>
                                              <span className={`px-2 py-0.5 rounded-full font-bold tracking-wider text-[10px] ${todo.is_completed ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                                  {todo.is_completed ? 'TAMAMLANDI' : 'BEKLİYOR'}
                                              </span>
                                          </div>
                                      </div>

                                      <button
                                          onClick={() => deleteTodo(todo.id)}
                                          className="text-gray-300 hover:text-red-500 p-2 md:opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50"
                                          title="Sil"
                                      >
                                          <FiTrash2 className="text-lg" />
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  );
              })
          )}
      </div>

      {/* Floating Action Button (Mobile) & Fixed Button (Desktop) */}
      <div className="fixed md:static bottom-6 right-6 md:p-4 md:mt-auto flex justify-end">
          <button 
              onClick={() => openModalForDate(selectedDate)}
              className="bg-green-500 text-white rounded-full p-4 md:px-6 md:py-3 shadow-lg shadow-green-200 hover:bg-green-600 hover:scale-105 transition-all flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-green-100"
          >
              <FiPlus className="text-2xl md:text-xl md:mr-2" />
              <span className="hidden md:inline font-semibold">Yeni Görev</span>
          </button>
      </div>

      <TodoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        farmId={farmId}
        preselectedDate={selectedDateForNew}
        onTaskAdded={handleTaskAdded}
      />
    </div>
  );
};

export default TodoPage;
