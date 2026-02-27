import React from 'react';

export function FollowUpAppointments({ appointments }: { appointments: any[] }) {
    if (!appointments || appointments.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 ml-1">Follow-up Appointments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map((appt, idx) => {
                    const isCritical = appt.urgency === "critical";
                    return (
                        <div key={idx} className={`bg-white border rounded-xl p-5 shadow-sm relative overflow-hidden ${isCritical ? 'border-customRed/40' : 'border-gray-200'}`}>
                            {isCritical && <div className="absolute top-0 right-0 bg-customRed text-white text-[10px] font-bold uppercase px-3 py-1 rounded-bl-lg">Critical</div>}
                            <div className="flex gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCritical ? 'bg-customRed-light/40 text-customRed' : 'bg-sand text-navy'}`}>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-serif text-[17px] text-navy leading-tight">{appt.specialty}</h4>
                                    {appt.provider && <div className="text-[13px] text-gray-500 font-medium mb-1">{appt.provider}</div>}
                                    <div className="text-[14px] text-navy font-bold flex items-center gap-1.5 mt-2">
                                        <svg className="w-4 h-4 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        {appt.dateTime}
                                    </div>
                                    <div className="text-[13px] text-gray-600 mt-2 bg-gray-50 p-2 rounded leading-snug">
                                        {appt.purpose}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
