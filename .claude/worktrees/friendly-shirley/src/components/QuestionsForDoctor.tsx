import React from 'react';

interface QuestionsForDoctorProps {
    questions: string[];
}

export function QuestionsForDoctor({ questions }: QuestionsForDoctorProps) {
    if (!questions || questions.length === 0) {
        return null;
    }

    return (
        <section className="border rounded-lg p-4 bg-white">
            <h2 className="font-semibold text-lg mb-3 text-gray-900">
                Questions to Ask Your Doctor
            </h2>
            <ol className="list-decimal ml-5 space-y-2 text-gray-800">
                {questions.map((question, index) => (
                    <li key={index}>{question}</li>
                ))}
            </ol>
        </section>
    );
}
