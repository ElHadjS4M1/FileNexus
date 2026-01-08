import React from "react";

export function Input({ label, error, className = "", ...props }) {
    return (
        <div className={className}>
            {label && <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>}
            <input
                className="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition"
                {...props}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
    );
}

export function Button({ children, processing, className = "", ...props }) {
    return (
        <button
            disabled={processing}
            className={`w-full py-3 rounded-xl font-semibold transition disabled:opacity-60 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export function Modal({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl p-8 shadow-2xl relative animate-fade-in">
                {children}
            </div>
        </div>
    );
}
