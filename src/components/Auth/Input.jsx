const Input = ({ label, type, value, onChange, placeholder, className, ...props }) => {
    return (
      <div className={className}>
        <label htmlFor={label} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="mt-1">
          <input
            id={label}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
            {...props}
          />
        </div>
      </div>
    );
  };
  
  export default Input;
  
