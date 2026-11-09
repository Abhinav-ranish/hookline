"use client";

import { useState } from "react";
import type { Question } from "@/lib/schemas";

export function QuestionCard({ questions, busy, onAnswer, onSkip }: { questions: Question[]; busy: boolean; onAnswer: (text: string) => void; onSkip: () => void }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const complete = questions.every((_, index) => picked[index]);

  return (
    <div className="questions">
      {questions.map((question, index) => (
        <fieldset key={question.question}>
          <legend>{question.question}</legend>
          <div className="options">
            {question.options.map((option) => (
              <button key={option} className={picked[index] === option ? "is-on" : ""} aria-pressed={picked[index] === option} disabled={busy} onClick={() => setPicked({ ...picked, [index]: option })}>
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="actions">
        <button className="primary" disabled={!complete || busy} onClick={() => onAnswer(questions.map((q, i) => `${q.question} ${picked[i]}`).join("\n"))}>Continue</button>
        <button disabled={busy} onClick={onSkip}>Just write it</button>
      </div>
      <p className="hint">Or type your own answer below.</p>
    </div>
  );
}
