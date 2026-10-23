export type GameReportAnswer = {
  playerId: string; name: string; response: unknown; correct: boolean;
  awarded: number; responseMs: number | null;
};
export type GameReportSink = {
  created(input: { id:string; ownerId:string; deckId:number; deckTitle:string }): Promise<void>;
  round(input: {
    id:string; questionIndex:number; prompt:string; kind:string;
    options:string[]; correctAnswers:string[]; durationMs:number;
    playerAnswers:GameReportAnswer[];
  }): Promise<void>;
  finished(input: { id:string; mode:string; leaderboard:Array<{ playerId:string; name:string; score:number }> }): Promise<void>;
};
