import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

export default function Home() {
    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-extrabold text-indigo-600 tracking-tight sm:text-5xl">
                        MedLabLingo
                    </h1>
                    <p className="mt-2 text-base text-gray-500">
                        Understand your medical documents with AI.
                    </p>
                </div>

                <DisclaimerBanner />

                <div className="space-y-4">
                    <Link
                        href="/upload?documentType=lab_report"
                        className="w-full flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:text-xl md:px-10 shadow-sm transition-colors"
                    >
                        Understand My Lab Report
                    </Link>
                    <Link
                        href="/upload?documentType=discharge_instructions"
                        className="w-full flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:text-xl md:px-10 shadow-sm transition-colors"
                    >
                        Understand My Discharge Instructions
                    </Link>
                </div>

                <div className="text-center text-xs text-gray-400 mt-8">
                    <p>
                        Your privacy is important. Documents are processed securely and not stored permanently.
                    </p>
                </div>
            </div>
        </main>
    );
}
