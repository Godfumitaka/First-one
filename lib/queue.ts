import { analyzeNote } from './analysis';

const queue: number[] = [];
let running = false;

export function enqueueAnalysis(noteId: number) {
  queue.push(noteId);
  if (!running) {
    processQueue();
  }
}

async function processQueue() {
  running = true;
  while (queue.length > 0) {
    const noteId = queue.shift();
    if (noteId === undefined) continue;
    try {
      await analyzeNote(noteId);
    } catch (error) {
      console.error('Analysis failed', error);
    }
  }
  running = false;
}
