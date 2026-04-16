export function cleanInput(text) {
  return text
    .toLowerCase()
    .replace(/\b(uh|umm|hmm+|ah+|hello|hi|hey)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function isMeaningful(text) {
  if (!text) return false;
  const words = text.split(" ").filter(w => w.length > 2);
  return words.length > 0;
}