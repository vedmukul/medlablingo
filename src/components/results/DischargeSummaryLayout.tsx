import React from 'react';
import { WarningSigns } from './WarningSigns';
import { DailyMonitoring } from './DailyMonitoring';
import { DietCard } from './DietCard';
import { ActivityCard } from './ActivityCard';
import { ImagingCard } from './ImagingCard';
import { DiscontinuedMedsCard } from './DiscontinuedMedsCard';
import { FollowUpAppointments } from './FollowUpAppointments';
import { Immunizations } from './Immunizations';
import { NeonatalSection } from './NeonatalSection';
import { GeneralInstructions } from './GeneralInstructions';
import { LabsTable } from '../LabsTable';
import { openGoogleCalendarMeds } from '@/lib/calendar/generateICS';

export function DischargeSummaryLayout({ result, t }: { result: any, t?: any }) {
    const ds = result.dischargeSection || {};

    // Safety fallback
    if (!ds) return null;

    const meds = t?.medications ?? ds.medications ?? [];
    const stoppedMeds = result.discontinuedMedications ?? [];
    const imaging = result.imagingAndProcedures ?? [];
    const followUp = ds.followUpStructured?.length > 0 ? ds.followUpStructured : (t?.followUp ?? ds.followUp)?.map((f: string) => ({ specialty: "Follow-up", purpose: f }));

    const warningSigns = t?.warningSignsFromDoc ?? ds.warningSignsFromDoc ?? [];
    const generalRedFlags = t?.generalRedFlags ?? ds.generalRedFlags ?? [];
    const allWarnings = [...warningSigns, ...generalRedFlags];

    // Build general instructions array
    const generalSections = [
        { title: "Home Care Steps", content: t?.homeCareSteps ?? ds.homeCareSteps, icon: "🏠" },
        { title: "Wound & Incision Care", content: ds.woundCare, icon: "🩹" },
        { title: "Respiratory Precautions", content: ds.respiratoryPrecautions, icon: "🫁" },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-navy bg-sand px-3 py-1.5 rounded inline-block mb-2">Discharge Summary Details</h2>

            <WarningSigns signs={allWarnings} />

            {meds.length > 0 && (
                <div id="medications" className="scroll-mt-24 pt-2 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 ml-1">Current Medications</h3>
                        <button
                            onClick={() => {
                                openGoogleCalendarMeds(
                                    meds.map((m: any) => ({
                                        name: m.name,
                                        timing: m.timing,
                                        howToTake: m.howToTakeFromDoc,
                                        purpose: m.purposePlain,
                                    }))
                                );
                            }}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-navy hover:bg-navy-light px-3.5 py-2 rounded-lg transition-colors shadow-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Export All to Calendar
                        </button>
                    </div>
                    <div className="space-y-4">
                        {meds.map((m: any, i: number) => (
                            <div key={i} className="bg-white border-l-4 border-navy rounded-r-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <span className="font-serif text-xl text-navy leading-tight">{m.name}</span>
                                    {m.timing && <span className="bg-sand text-navy font-bold text-xs uppercase px-2 py-1 rounded whitespace-nowrap ml-4">⏱ {m.timing}</span>}
                                </div>
                                <p className="text-[15px] text-gray-700">{m.purposePlain || m.purpose}</p>
                                {m.howToTakeFromDoc && (
                                    <div className="text-navy bg-sand/30 p-3 mt-2 rounded bg-opacity-50 text-[14px] font-medium border border-sand">
                                        👉 {m.howToTakeFromDoc}
                                    </div>
                                )}
                                {m.cautionsGeneral && (
                                    <div className="flex gap-2 items-start text-amber-900 bg-amber-50 p-3 rounded-lg text-[13px] mt-2 border border-amber-100">
                                        <span className="shrink-0">⚠️</span>
                                        <p className="leading-snug">{m.cautionsGeneral}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <DiscontinuedMedsCard meds={stoppedMeds} />

            <div id="appointments" className="scroll-mt-24">
                <FollowUpAppointments appointments={followUp} />
            </div>

            <div id="diet-activity" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <DietCard diet={ds.dietInstructions} />
                <ActivityCard activityRestrictions={ds.activityRestrictions} />
            </div>

            <div id="monitoring" className="scroll-mt-24">
                <DailyMonitoring monitoring={ds.dailyMonitoring} />
            </div>

            <div id="home-care" className="scroll-mt-24">
                <GeneralInstructions sections={generalSections} />
            </div>

            <NeonatalSection
                feedingPlan={ds.feedingPlan}
                safeSleep={ds.safeSleepInstructions}
                development={ds.developmentalGuidance}
                birthHistory={result.birthHistory}
            />

            {/* Labs Section */}
            {result.labsSection?.labs?.length > 0 && (
                <div id="labs" className="scroll-mt-24 pt-2">
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-4 ml-1">Key Findings</h3>
                    <div className="mb-6">
                        <LabsTable
                            labs={result.labsSection.labs}
                            overallNote={t?.overallLabNote ?? result.labsSection.overallLabNote}
                            translatedLabs={t?.labExplanations}
                        />
                    </div>
                </div>
            )}

            <div id="imaging" className="scroll-mt-24">
                <ImagingCard items={imaging} />
            </div>

            <Immunizations immunizations={result.immunizations} />

        </div>
    );
}
