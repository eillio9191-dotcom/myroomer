let pending = false;

export function queueSave(fn: () => Promise<void>) {
  if (pending) return;

  pending = true;

  setTimeout(async () => {
    await fn();
    pending = false;
  }, 1000);
}