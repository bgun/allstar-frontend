export function Button({ children, variant = 'primary', disabled = false, className = '', ...props }) {
  const baseStyles = 'px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 focus:outline-none focus:ring-4'

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg disabled:hover:bg-blue-600 focus:ring-blue-200',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 hover:shadow-md disabled:hover:bg-gray-200 focus:ring-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg disabled:hover:bg-red-600 focus:ring-red-200'
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
