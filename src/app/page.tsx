import Link from "next/link";
import { ClipboardList, FlaskConical, History } from "lucide-react";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const ctaBase =
    "w-full min-h-[48px] flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-[16px] font-semibold motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-warmBase";

/** Next.js 15+ passes route `params` as a Promise — await even when empty (avoids sync enumeration / devtools warnings). */
export default async function Home({
    params,
}: {
    params: Promise<Record<string, string | string[] | undefined>>;
}) {
    await params;

    return (
        <main className="min-h-dvh bg-warmBase flex flex-col items-center justify-center p-6">
            <div className="max-w-lg w-full space-y-8">
                <header className="text-center space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-sage">Patient-friendly summaries</p>
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold text-navy tracking-tight">
                        MedLabLingo
                    </h1>
                    <p className="text-[15px] text-gray-600 leading-relaxed max-w-sm mx-auto">
                        Turn lab reports and discharge paperwork into plain language you can use at home and with your care team.
                    </p>
                </header>

                <DisclaimerBanner />

                <nav aria-label="Get started" className="space-y-3">
                    <Link
                        href="/upload"
                        className={`${ctaBase} bg-navy text-white hover:bg-navy-light focus-visible:ring-navy/50 shadow-sm`}
                    >
                        <FlaskConical className="w-5 h-5 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
                        Understand my lab report
                    </Link>
                    <Link
                        href="/upload"
                        className={`${ctaBase} bg-sand text-navy border border-sand-dark hover:bg-sand-dark/80 focus-visible:ring-navy/35 shadow-sm`}
                    >
                        <ClipboardList className="w-5 h-5 shrink-0 text-teal" strokeWidth={1.75} aria-hidden />
                        Understand my discharge paperwork
                    </Link>
                    <Link
                        href="/history"
                        className={`${ctaBase} bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-navy focus-visible:ring-navy/30 text-[15px] font-medium`}
                    >
                        <History className="w-5 h-5 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden />
                        View history &amp; trends
                    </Link>
                </nav>

                <p className="text-center text-[12px] text-gray-500 leading-relaxed px-2">
                    Your privacy matters. Text is processed to generate a summary; we do not keep your full document on our servers.
                </p>
            </div>
        </main>
    );
}
