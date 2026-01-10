import React from 'react';

export function Loading() {
    return (
        <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600 font-medium">Analyzing document...</span>
        </div>
    );
}
