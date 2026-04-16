// stateMachine.js

export function createCallState() {
  return {
    questions: [],
    currentQuestionIndex: 0,
    currentQuestionId: null,
    answers: [],
    waitingForAnswer: false,
    completed: false,
    silenceTimer: null,
    lastEmotion: "neutral"
  };
}