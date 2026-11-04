/** Ignore late acknowledgments for earlier rounds. The server owns the question index. */
export function shouldAcceptAnswerAck(currentQuestionIndex: number | undefined, acknowledgedQuestionIndex: number): boolean {
  return Number.isInteger(currentQuestionIndex) && currentQuestionIndex === acknowledgedQuestionIndex;
}
