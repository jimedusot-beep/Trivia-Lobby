// Original transport contracts. Identity always comes from the authenticated socket.
import { validateGuestQuiz } from "./custom-quiz.js";
const fail = (message) => {
  throw new Error(message);
};
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function fields(message, required, optional = []) {
  if (!object(message)) fail("Invalid message.");
  if (required.some((key) => !Object.hasOwn(message, key)))
    fail("Missing message field.");
  if (
    Object.keys(message).some(
      (key) => ![...required, ...optional].includes(key),
    )
  )
    fail("Unknown message field.");
}
export function validateHello(message) {
  if (!object(message)) fail("Invalid connection message.");
  if (!["create", "join", "resume"].includes(message.type))
    fail("Create or join a room first.");
  const required = {
    create: ["type"],
    join: ["type", "code", "name"],
    resume: ["type", "code", "actor", "token"],
  }[message.type];
  if (!required) fail("Create or join a room first.");
  fields(message, required, message.type === "create" ? ["quiz"] : []);
  if (
    message.type !== "create" &&
    (typeof message.code !== "string" ||
      !/^[A-HJ-NP-Z2-9]{6}$/i.test(message.code))
  )
    fail("Enter a valid six-character code.");
  if (
    message.type === "join" &&
    (typeof message.name !== "string" ||
      !message.name.trim() ||
      message.name.trim().length > 24)
  )
    fail("Nickname must contain 1–24 characters.");
  if (
    message.type === "resume" &&
    (!(message.actor === "host" || uuid(message.actor)) ||
      typeof message.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(message.token))
  )
    fail("Invalid reconnect credential.");
  if (message.type === "create" && Object.hasOwn(message, "quiz"))
    validateGuestQuiz(message.quiz);
  return message;
}
export function validateAction(message) {
  if (!object(message)) fail("Invalid message envelope.");
  if (
    !["start", "answer", "write", "vote", "next", "lobby", "mark"].includes(
      message.type,
    )
  )
    fail("Unknown action.");
  const payload = {
    start: ["value"],
    answer: ["value"],
    write: ["value", "promptIndex"],
    vote: ["value"],
    next: [],
    lobby: [],
    mark: ["value", "clueId"],
  }[message.type];
  if (!payload) fail("Unknown action.");
  fields(
    message,
    ["v", "type", "requestId", "matchId", "revision", ...payload],
    message.type === "start" ? ["category"] : [],
  );
  if (
    message.v !== 1 ||
    typeof message.requestId !== "string" ||
    !/^[\w-]{8,80}$/.test(message.requestId) ||
    !Number.isSafeInteger(message.revision) ||
    message.revision < 0 ||
    !(message.matchId === null || uuid(message.matchId))
  )
    fail("Invalid message envelope.");
  if (
    message.type === "start" &&
    !["quiz", "duel", "charades"].includes(message.value)
  )
    fail("Unknown game mode.");
  if (
    message.type === "answer" &&
    (!Number.isInteger(message.value) || message.value < 0 || message.value > 3)
  )
    fail("Invalid choice.");
  if (
    message.type === "write" &&
    (!Number.isInteger(message.promptIndex) ||
      message.promptIndex < 0 ||
      message.promptIndex > 7 ||
      typeof message.value !== "string" ||
      !message.value.trim() ||
      message.value.trim().length > 240)
  )
    fail("Invalid prompt or response.");
  if (message.type === "vote" && !uuid(message.value)) fail("Invalid vote.");
  if (
    message.type === "start" &&
    Object.hasOwn(message, "category") &&
    (message.value !== "charades" ||
      !["actions", "animals"].includes(message.category))
  )
    fail("Invalid Charades pack.");
  if (
    message.type === "mark" &&
    (!uuid(message.clueId) || !["correct", "pass"].includes(message.value))
  )
    fail("Invalid Charades mark.");
  return message;
}
