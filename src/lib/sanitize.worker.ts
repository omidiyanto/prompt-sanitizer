import { sanitize } from './sanitize';
import { toOptions, type Settings } from './settings';

export interface WorkerRequest {
  id: number;
  text: string;
  settings: Settings;
}

addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, text, settings } = event.data;
  try {
    postMessage({ id, result: sanitize(text, toOptions(settings)) });
  } catch {
    postMessage({ id, error: 'The detection engine failed on this input.' });
  }
});
