import React from 'react';
import {
    Apple,
    Baby,
    Ban,
    Bandage,
    CalendarDays,
    Camera,
    ClipboardList,
    FlaskConical,
    Home,
    Pill,
    Syringe,
    Wind,
} from 'lucide-react';
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
import { CollapsibleSection } from './CollapsibleSection';
import { openGoogleCalendarMeds } from '@/lib/calendar/generateICS';

export function DischargeSummaryLayout({ result, t }: { result: any, t?: any }) {
    const ds = result.dischargeSection || {};

    if (!ds) return null;

    const meds = t?.medications ?? ds.medications ?? [];
    const stoppedMeds = result.discontinuedMedications ?? [];
    const imaging = result.imagingAndProcedures ?? [];
    const followUp = ds.followUpStructured?.length > 0
        ? ds.followUpStructured
        : (t?.followUp ?? ds.followUp)?.map((f: string) => ({ specialty: "Follow-up", purpose: f }));

    const warningSigns = t?.warningSignsFromDoc ?? ds.warningSignsFromDoc ?? [];
    const generalRedFlags = t?.generalRedFlags ?? ds.generalRedFlags ?? [];
    const allWarnings = [...warningSigns, ...generalRedFlags];

    const monitoring = t?.dailyMonitoring ?? ds.dailyMonitoring ?? [];
    const homeCareSteps = t?.homeCareSteps ?? ds.homeCareSteps ?? [];
    const labs = result.labsSection?.labs ?? [];
    const immunizations = result.immunizations ?? [];
    const urgentAppts = (followUp ?? []).filter((a: any) => a.urgency === 'critical').length;

    const giCls = "w-5 h-5 text-teal shrink-0";

    const generalSections = [
        { title: "Home Care Steps", content: homeCareSteps, icon: <Home className={giCls} strokeWidth={1.75} aria-hidden /> },
        { title: "Wound & Incision Care", content: ds.woundCare, icon: <Bandage className={giCls} strokeWidth={1.75} aria-hidden /> },
        { title: "Respiratory Precautions", content: ds.respiratoryPrecautions, icon: <Wind className={giCls} strokeWidth={1.75} aria-hidden /> },
    ];

    return (
        <div className="space-y-6">

            {/* ═══ TIER 1: Always visible ═══ */}

            {/* Warning Signs — always visible, warm amber accent */}
            {allWarnings.length > 0 && (
                <WarningSigns signs={allWarnings} />
            )}

            {/* ═══ TIER 2: Collapsed with preview ═══ */}

            {/* Medications */}
            {meds.length > 0 && (
                <CollapsibleSection
                    id="medications"
                    title="Medications"
                    icon={<Pill className="w-5 h-5 text-teal shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={meds.length}
                    preview={meds.slice(0, 2).map((m: any) => m.name).join(", ")}
                    accentColor="border-teal"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Current Medications</span>
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
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy bg-sand hover:bg-sand-dark px-3 py-2 min-h-[40px] rounded-lg motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/35 focus-visible:ring-offset-2"
                        >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2H8v2H4.5a.5.5 0 0 0-.5.5v15a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V16h2v3.5a2.5 2.5 0 0 1-2.5 2.5zM8 7V3h8v4H8zm10-4h2v4h-2V3zM6 3h0V3zm0 8h12v2H6v-2zm0 4h8v2H6v-2z" /></svg>
                            Add to Google Calendar
                        </button>
                    </div>
                    <div className="space-y-3">
                        {meds.map((m: any, i: number) => (
                            <div key={i} className="bg-warmBase rounded-lg p-4 flex flex-col gap-1.5">
                                <div className="flex justify-between items-start">
                                    <span className="font-semibold text-[15px] text-navy leading-tight">{m.name}</span>
                                    {m.timing && <span className="bg-teal-light text-teal font-semibold text-[11px] px-2 py-0.5 rounded whitespace-nowrap ml-3">{m.timing}</span>}
                                </div>
                                <p className="text-[14px] text-gray-600">{m.purposePlain || m.purpose}</p>
                                {m.howToTakeFromDoc && (
                                    <p className="text-[13px] text-navy bg-white p-2.5 rounded mt-1 border border-gray-100 leading-snug">
                                        {m.howToTakeFromDoc}
                                    </p>
                                )}
                                {m.cautionsGeneral && (
                                    <div className="flex gap-2 items-start text-amber bg-amber-light/60 p-2.5 rounded text-[12px] mt-1">
                                        <span className="shrink-0 inline-flex" aria-hidden>
                                            <svg className="w-4 h-4 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                        <p className="leading-snug">{m.cautionsGeneral}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            )}

            {stoppedMeds.length > 0 && (
                <CollapsibleSection
                    title="Discontinued Medications"
                    icon={<Ban className="w-5 h-5 text-gray-500 shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={stoppedMeds.length}
                    accentColor="border-gray-300"
                >
                    <DiscontinuedMedsCard meds={stoppedMeds} />
                </CollapsibleSection>
            )}

            {/* Follow-up Appointments */}
            {followUp?.length > 0 && (
                <CollapsibleSection
                    id="appointments"
                    title="Follow-up Appointments"
                    icon={<CalendarDays className="w-5 h-5 text-navy shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={followUp.length}
                    urgentCount={urgentAppts}
                    preview={followUp.slice(0, 2).map((a: any) => a.specialty).join(", ")}
                    accentColor="border-navy"
                >
                    <FollowUpAppointments appointments={followUp} />
                </CollapsibleSection>
            )}

            {/* Daily Monitoring */}
            {monitoring.length > 0 && (
                <CollapsibleSection
                    id="monitoring"
                    title="Daily Monitoring Checklist"
                    icon={<ClipboardList className="w-5 h-5 text-sage shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={monitoring.length}
                    preview="Temperature, feeding, diaper tracking..."
                    accentColor="border-sage"
                >
                    <DailyMonitoring monitoring={monitoring} />
                </CollapsibleSection>
            )}

            {/* Diet & Activity */}
            {(ds.dietInstructions || ds.activityRestrictions) && (
                <CollapsibleSection
                    id="diet-activity"
                    title="Diet & Activity"
                    icon={<Apple className="w-5 h-5 text-sage shrink-0" strokeWidth={1.75} aria-hidden />}
                    accentColor="border-sage"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DietCard diet={ds.dietInstructions} />
                        <ActivityCard activityRestrictions={ds.activityRestrictions} />
                    </div>
                </CollapsibleSection>
            )}

            {/* Home Care / General Instructions */}
            {homeCareSteps.length > 0 && (
                <CollapsibleSection
                    id="home-care"
                    title="Home Care Instructions"
                    icon={<Home className="w-5 h-5 text-sage shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={homeCareSteps.length}
                    accentColor="border-sage"
                >
                    <GeneralInstructions sections={generalSections} />
                </CollapsibleSection>
            )}

            {/* Neonatal Guidance */}
            {(ds.feedingPlan || ds.safeSleepInstructions || ds.developmentalGuidance) && (
                <CollapsibleSection
                    title="Neonatal Guidance"
                    icon={<Baby className="w-5 h-5 text-teal shrink-0" strokeWidth={1.75} aria-hidden />}
                    accentColor="border-teal"
                >
                    <NeonatalSection
                        feedingPlan={ds.feedingPlan}
                        safeSleep={ds.safeSleepInstructions}
                        development={ds.developmentalGuidance}
                        birthHistory={result.birthHistory}
                    />
                </CollapsibleSection>
            )}

            {/* ═══ TIER 3: Reference sections ═══ */}

            {/* Labs */}
            {labs.length > 0 && (
                <CollapsibleSection
                    id="labs"
                    title="Lab Results"
                    icon={<FlaskConical className="w-5 h-5 text-gray-500 shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={labs.length}
                    preview={labs.slice(0, 3).map((l: any) => l.name).join(", ")}
                    accentColor="border-gray-300"
                >
                    <LabsTable
                        labs={labs}
                        overallNote={t?.overallLabNote ?? result.labsSection?.overallLabNote}
                        translatedLabs={t?.labExplanations}
                    />
                </CollapsibleSection>
            )}

            {/* Imaging & Procedures */}
            {imaging.length > 0 && (
                <CollapsibleSection
                    id="imaging"
                    title="Imaging & Procedures"
                    icon={<Camera className="w-5 h-5 text-gray-500 shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={imaging.length}
                    preview={imaging.slice(0, 2).map((im: any) => im.name || im.study).join(", ")}
                    accentColor="border-gray-300"
                >
                    <ImagingCard items={imaging} />
                </CollapsibleSection>
            )}

            {/* Immunizations */}
            {immunizations.length > 0 && (
                <CollapsibleSection
                    id="vaccines"
                    title="Vaccines & Immunizations"
                    icon={<Syringe className="w-5 h-5 text-gray-500 shrink-0" strokeWidth={1.75} aria-hidden />}
                    count={immunizations.length}
                    accentColor="border-gray-300"
                >
                    <Immunizations immunizations={immunizations} />
                </CollapsibleSection>
            )}
        </div>
    );
}
