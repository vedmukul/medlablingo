import Link from 'next/link';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

export default function Home() {
    return (
        <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-title font-semibold text-accent tracking-tight">
                        MedLabLingo
                    </h1>
                    <p className="mt-2 text-body text-text-secondary">
                        Understand your medical documents in plain language
                    </p>
                </div>

                <DisclaimerBanner />

                <div className="space-y-4">
                    <Link
                        href="/upload?documentType=lab_report"
                        className="w-full flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-card text-text-inverse bg-accent hover:bg-accent-dark md:text-xl md:px-10 shadow-card hover:shadow-card-hover transition-all"
                    >
                        Understand My Lab Report
                    </Link>
                    <Link
                        href="/upload?documentType=discharge_instructions"
                        className="w-full flex items-center justify-center px-8 py-4 border border-accent-muted text-lg font-medium rounded-card text-accent-dark bg-surface-card hover:bg-accent-light md:text-xl md:px-10 shadow-card hover:shadow-card-hover transition-all"
                    >
                        Understand My Discharge Instructions
                    </Link>
                </div>

                <div className="text-center text-xs text-text-muted mt-8 space-y-1">
                    <p>Educational use only. Not medical advice.</p>
                    <p>Your documents are processed securely and never stored permanently.</p>
                </div>
            </div>
        </main>
    );
}
