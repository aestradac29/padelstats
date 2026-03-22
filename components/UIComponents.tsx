
import React, { useState } from 'react';
import { Eye, EyeOff, Check, ChevronDown } from './Icons';

export const PadelLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#a3e635" stroke="#ffffff" strokeWidth="2" /> 
    <circle cx="50" cy="50" r="46" fill="url(#fuzz)" fillOpacity="0.15" />
    <path 
      d="M 2 50 L 30 50 L 40 25 L 50 75 L 60 50 L 98 50" 
      fill="none" 
      stroke="#ffffff"
      strokeWidth="5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <defs>
      <filter id="fuzz">
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
      </filter>
    </defs>
  </svg>
);

export const Button = ({ 
  children, onClick, variant = 'primary', className = '', disabled = false, type = 'button'
}: { 
  children?: React.ReactNode, onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void, variant?: 'primary' | 'secondary' | 'danger' | 'ghost', className?: string, disabled?: boolean, type?: 'button' | 'submit'
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-lime-400 text-blue-950 hover:bg-lime-300 shadow-md hover:shadow-lg shadow-lime-400/20",
    secondary: "bg-white dark:bg-slate-800 text-blue-900 dark:text-blue-100 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-400 hover:text-blue-700 dark:hover:text-white shadow-sm",
    danger: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800",
    ghost: "text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700 p-6 ${className || ''}`} {...props}>
    {children}
  </div>
);

export const Input = ({ label, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="flex flex-col gap-1 w-full relative">
            {label && <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <input 
                className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-full font-medium pr-10 [color-scheme:light] dark:[color-scheme:dark]"
                type={inputType}
                {...props} 
                />
                {isPassword && (
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
        </div>
    );
};

export const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: {value: string, label: string}[] }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>}
    <div className="relative">
        <select 
          style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          className={`custom-select px-4 py-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-full font-bold appearance-none !appearance-none [color-scheme:light] dark:[color-scheme:dark] ${props.className || ''}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="text-slate-900 dark:text-white bg-white dark:bg-slate-900 font-medium">
                {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
    </div>
  </div>
);

export const Checkbox = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (checked: boolean) => void }) => (
    <div 
        onClick={() => onChange(!checked)}
        className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all ${checked ? 'border-lime-400 bg-lime-50 dark:bg-lime-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
    >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${checked ? 'bg-lime-400 border-lime-400' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}>
            {checked && <Check size={14} className="text-blue-900" />}
        </div>
        <span className="font-medium text-slate-700 dark:text-slate-200 select-none">{label}</span>
    </div>
);