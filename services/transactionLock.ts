const userTransactionLocks = new Map<string, Promise<void>>();

export const withUserTransactionLock = async <T>(
  userId: string,
  task: () => Promise<T>,
) => {
  const previous = userTransactionLocks.get(userId) || Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);

  userTransactionLocks.set(userId, queued);
  await previous;

  try {
    return await task();
  } finally {
    release();

    if (userTransactionLocks.get(userId) === queued) {
      userTransactionLocks.delete(userId);
    }
  }
};

