import { useMemo } from "react";
import { withoutAnswerKeys, type UniversalQuestion } from "@shared/universal-questions";

/**
 * Creator preview deliberately uses the same answer-key-free question projection
 * as student practice. Correct answers and evidence never appear in the preview.
 */
export function QuestionPreview({question}:{question:UniversalQuestion}){
  const view=useMemo(()=>withoutAnswerKeys(question),[question]);
  const answer=view.answer;
  const choices = answer.kind==="multiple_choice" || answer.kind==="multiple_select"
    ? answer.options.map(option=>option.label)
    : answer.kind==="true_false" ? ["True","False"]
    : answer.kind==="ordering" ? answer.items.map(item=>item.label)
    : answer.kind==="matching" ? answer.prompts.map(item=>item.prompt)
    : [];
  const ready = answer.kind==="multiple_choice" || answer.kind==="true_false" ||
    answer.kind==="multiple_select" || answer.kind==="ordering";
  return <section aria-label="Question player preview" className="rounded-2xl border-2 border-blue-300 bg-linear-to-br from-blue-950 to-red-950 text-white p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="font-semibold">Player preview · {answer.kind.replaceAll("_"," ")}</span>
      <span>{question.gameplay?.timeLimitSeconds ?? 30}s · {question.gameplay?.points==="double"?"Double":"Standard"} points</span>
    </div>
    <h3 className="text-xl font-bold">{view.prompt}</h3>
    {ready ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {choices.map((text,i)=><div key={i} className={"rounded-xl border border-white/20 p-4 font-semibold "+(i%2?"bg-red-700":"bg-blue-700")}>
        {answer.kind==="multiple_select"?"☐ ":answer.kind==="ordering"?String(i+1)+". ":""}{text}
      </div>)}
    </div>:<p className="rounded bg-white/10 p-3 text-sm">
      This question is available for study. Live gameplay support for this format has not yet been implemented.
    </p>}
    <p className="text-xs text-white/80">Preview only. No answers are submitted and no correct-answer keys are displayed.</p>
  </section>;
}
