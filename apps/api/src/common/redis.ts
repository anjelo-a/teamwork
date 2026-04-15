import Redis, { type RedisOptions } from 'ioredis';

interface TaskRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<string | null>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

type RedisClient = InstanceType<typeof Redis>;

const redisUrl = process.env['REDIS_URL'];
const redisOptions: RedisOptions = {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
};

let client: RedisClient | null = null;

function getRedisClient(): RedisClient | null {
  if (!redisUrl) {
    return null;
  }

  if (client) {
    return client;
  }

  client = new Redis(redisUrl, redisOptions);
  client.on('error', () => {
    // Best-effort cache client: failures are handled per operation.
  });
  return client;
}

async function runRedisCommand<T>(
  fallbackValue: T,
  command: (activeClient: RedisClient) => Promise<T>,
): Promise<T> {
  const activeClient = getRedisClient();

  if (!activeClient) {
    return fallbackValue;
  }

  try {
    return await command(activeClient);
  } catch {
    await closeRedisClient();
    return fallbackValue;
  }
}

export const redis: TaskRedisClient = {
  async get(key) {
    return runRedisCommand(null, async (activeClient) => activeClient.get(key));
  },
  async set(key, value, mode, seconds) {
    return runRedisCommand(null, async (activeClient) =>
      activeClient.set(key, value, mode, seconds),
    );
  },
  async keys(pattern) {
    return runRedisCommand([], async (activeClient) => activeClient.keys(pattern));
  },
  async del(...keys) {
    if (keys.length === 0) {
      return 0;
    }

    return runRedisCommand(0, async (activeClient) => activeClient.del(...keys));
  },
};

export async function closeRedisClient(): Promise<void> {
  const activeClient = client;
  client = null;

  if (!activeClient) {
    return;
  }

  try {
    await activeClient.quit();
  } catch {
    activeClient.disconnect();
  }
}
