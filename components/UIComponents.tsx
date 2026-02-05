import React, { useState } from 'react';
import { Eye, EyeOff, Check, ChevronDown } from './Icons';

export const PadelLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#a3e635" stroke="#ffffff" strokeWidth="2" /> 
    <circle cx="50" cy="50" r="46" fill="url(#fuzz)" fillOpacity="0.15" />
    <path 
      d="M15 50 L 35 50 L 45 25 L 55 75 L 65 50 L 85 50" 
      fill="none" 
      stroke="#1e3a8a"
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
  children?: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'secondary' | 'danger' | 'ghost', className?: string, disabled?: boolean, type?: 'button' | 'submit'
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-lime-400 text-blue-950 hover:bg-lime-300 shadow-md hover:shadow-lg shadow-lime-400/20",
    secondary: "bg-white text-blue-900 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-700 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost: "text-slate-500 hover:text-blue-900 hover:bg-slate-100"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 ${className || ''}`} {...props}>
    {children}
  </div>
);

export const Input = ({ label, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="flex flex-col gap-1 w-full relative">
            {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <input 
                className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-full font-medium pr-10 [color-scheme:light]"
                type={inputType}
                {...props} 
                />
                {isPassword && (
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
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
    {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
    <div className="relative">
        <select 
          style={{ 
            backgroundColor: 'white', 
            color: '#0f172a',
            appearance: 'none',
            MozAppearance: 'none',
            WebkitAppearance: 'none'
          }}
          className={`px-4 py-3 rounded-xl border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-full font-bold appearance-none [color-scheme:light] ${props.className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="text-slate-900 bg-white font-medium">
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
        className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all ${checked ? 'border-lime-400 bg-lime-50' : 'border-slate-200 bg-slate-50'}`}
    >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${checked ? 'bg-lime-400 border-lime-400' : 'bg-white border-slate-300'}`}>
            {checked && <Check size={14} className="text-blue-900" />}
        </div>
        <span className="font-medium text-slate-700 select-none">{label}</span>
    </div>
);
