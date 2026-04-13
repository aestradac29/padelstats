
import React, { useState } from 'react';
import { Eye, EyeOff, Check, ChevronDown } from './Icons';

export const PadelLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="28" y="8" width="44" height="52" rx="22" fill="#a3e635" />
    <rect x="34" y="14" width="32" height="40" rx="16" fill="#84cc16" />
    <circle cx="44" cy="26" r="3.5" fill="#65a30d" />
    <circle cx="56" cy="26" r="3.5" fill="#65a30d" />
    <circle cx="44" cy="36" r="3.5" fill="#65a30d" />
    <circle cx="56" cy="36" r="3.5" fill="#65a30d" />
    <circle cx="50" cy="44" r="3.5" fill="#65a30d" />
    <rect x="44" y="58" width="12" height="28" rx="6" fill="#1e3a8a" />
    <rect x="46" y="60" width="8" height="20" rx="4" fill="#1d4ed8" />
    <line x1="46" y1="65" x2="54" y2="65" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="46" y1="70" x2="54" y2="70" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="46" y1="75" x2="54" y2="75" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const StatBadge = ({ label, value, color = 'lime' }: { label: string, value: string | number, color?: string }) => {
  const colorMap: Record<string, string> = {
    lime: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${colorMap[color] || colorMap.slate}`}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
};

export const Button = ({ 
  children, onClick, variant = 'primary', className = '', disabled = false, type = 'button', size = 'md'
}: { 
  children?: React.ReactNode, 
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void, 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success', 
  className?: string, 
  disabled?: boolean, 
  type?: 'button' | 'submit',
  size?: 'sm' | 'md' | 'lg'
}) => {
  const sizeStyles: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const baseStyle = `${sizeStyles[size]} rounded-xl font-bold uppercase tracking-wide transition-all duration-200 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`;
  
  const variants: Record<string, string> = {
    primary: "bg-lime-400 text-blue-950 hover:bg-lime-300 shadow-md hover:shadow-lg shadow-lime-400/20 hover:shadow-lime-400/30",
    secondary: "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-700 dark:hover:text-white shadow-sm hover:shadow-md",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800",
    ghost: "text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800",
    success: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-md shadow-emerald-500/20",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', hoverable = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) => (
  <div 
    className={`bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/60 p-6 ${hoverable ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer' : ''} ${className || ''}`} 
    {...props}
  >
    {children}
  </div>
);

export const GlassCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`backdrop-blur-sm bg-white/70 dark:bg-slate-800/70 rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/50 p-6 ${className}`}>
    {children}
  </div>
);

export const Input = ({ label, type = "text", hint, value, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, hint?: string }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="flex flex-col gap-1.5 w-full relative">
            {label && <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>}
            <div className="relative">
                <input 
                  className="px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all w-full font-medium pr-10 placeholder:text-slate-400 dark:placeholder:text-slate-600 [color-scheme:light] dark:[color-scheme:dark]"
                  type={inputType}
                  value={value !== undefined ? value : ''}
                  {...props} 
                />
                {isPassword && (
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
    );
};

export const Select = ({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: {value: string, label: string}[] }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>}
    <div className="relative">
        <select 
          style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
          className={`custom-select px-4 py-3 pr-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all w-full font-bold appearance-none !appearance-none [color-scheme:light] dark:[color-scheme:dark] ${props.className || ''}`}
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

export const Checkbox = ({ label, checked, onChange, description }: { label: string, checked: boolean, onChange: (checked: boolean) => void, description?: string }) => (
    <div 
        onClick={() => onChange(!checked)}
        className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${checked ? 'border-lime-400 bg-lime-50 dark:bg-lime-900/20 shadow-sm shadow-lime-400/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'}`}
    >
        <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200 ${checked ? 'bg-lime-400 border-lime-400 scale-105' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}>
            {checked && <Check size={12} className="text-blue-900 font-black" strokeWidth={3} />}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700 dark:text-slate-200 select-none text-sm">{label}</span>
          {description && <span className="text-xs text-slate-400 dark:text-slate-500 select-none">{description}</span>}
        </div>
    </div>
);

export const Divider = ({ label }: { label?: string }) => (
  <div className="relative my-4">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-slate-100 dark:border-slate-800" />
    </div>
    {label && (
      <div className="relative flex justify-center">
        <span className="px-3 bg-white dark:bg-slate-900 text-xs font-bold uppercase tracking-widest text-slate-400">
          {label}
        </span>
      </div>
    )}
  </div>
);

export const EmptyState = ({ icon, title, message, action }: { icon?: React.ReactNode, title: string, message: string, action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    {icon && (
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
        {icon}
      </div>
    )}
    <h3 className="font-black text-slate-700 dark:text-slate-300 text-lg">{title}</h3>
    <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-xs">{message}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const LoadingSpinner = ({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg', label?: string }) => {
  const sizeMap: Record<string, string> = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizeMap[size]} border-4 border-slate-200 dark:border-slate-700 border-t-lime-500 rounded-full animate-spin`} />
      {label && <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>}
    </div>
  );
};

export const ResultBadge = ({ result }: { result: 'WIN' | 'LOSS' | 'DRAW' | 'PENDING' }) => {
  const config: Record<string, { label: string, className: string }> = {
    WIN: { label: 'Victoria', className: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300 border border-lime-200 dark:border-lime-800' },
    LOSS: { label: 'Derrota', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800' },
    DRAW: { label: 'Empate', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
    PENDING: { label: 'Pendiente', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
  };
  const { label, className } = config[result] || config.PENDING;
  return <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider ${className}`}>{label}</span>;
};

export const ProgressBar = ({ value, max, color = 'lime', showLabel = false }: { value: number, max: number, color?: string, showLabel?: boolean }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colorMap: Record<string, string> = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-500',
    red: 'bg-red-400',
    amber: 'bg-amber-400',
  };
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color] || colorMap.lime}`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
      {showLabel && <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-8 text-right">{pct}%</span>}
    </div>
  );
};

export const Avatar = ({ name, photoUrl, size = 'md' }: { name: string, photoUrl?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeMap: Record<string, string> = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeMap[size]} rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm`} />;
  }
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  return (
    <div className={`${sizeMap[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center font-black text-white shadow-sm border-2 border-white dark:border-slate-700 flex-shrink-0`}>
      {initials}
    </div>
  );
};
