import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
export const PERF_OUTPUT_DIR = path.join(REPO_ROOT, 'docs', 'perf');

export class HttpRequestError extends Error {
  constructor({ method, endpoint, status, message, responseBody }) {
    super(`${method} ${endpoint} failed (${status}): ${message}`);
    this.name = 'HttpRequestError';
    this.method = method;
    this.endpoint = endpoint;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function getEnvString(name, fallback) {
  const value = process.env[name];

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

export function getEnvInteger(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim().length === 0) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return value;
}

export async function ensurePerfOutputDirectory() {
  await fs.mkdir(PERF_OUTPUT_DIR, { recursive: true });
}

export function resolvePerfArtifactPath(name) {
  return path.join(PERF_OUTPUT_DIR, name);
}

export async function writeJsonArtifact(fileName, value) {
  await ensurePerfOutputDirectory();
  const outputPath = resolvePerfArtifactPath(fileName);
  await fs.writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return outputPath;
}

export async function writeMarkdownArtifact(fileName, content) {
  await ensurePerfOutputDirectory();
  const outputPath = resolvePerfArtifactPath(fileName);
  await fs.writeFile(outputPath, `${content.trimEnd()}\n`, 'utf8');
  return outputPath;
}

export function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function requestJson(baseUrl, endpoint, options = {}) {
  const url = `${stripTrailingSlash(baseUrl)}${endpoint}`;
  const method = options.method ?? 'GET';
  const headers = {
    Accept: 'application/json',
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const json = text.length > 0 ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      json && typeof json === 'object' && !Array.isArray(json) && typeof json.message === 'string'
        ? json.message
        : response.statusText;
    throw new HttpRequestError({
      method,
      endpoint,
      status: response.status,
      message,
      responseBody: json,
    });
  }

  return json;
}

export function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function quantile(values, percentile) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = (percentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];
  const weight = rank - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * weight;
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function summarizeNumberSeries(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    avg: round(total / values.length),
    p50: round(quantile(values, 50)),
    p95: round(quantile(values, 95)),
    p99: round(quantile(values, 99)),
  };
}

export function formatMs(value) {
  return `${round(value)}ms`;
}

export function toIsoTimestamp() {
  return new Date().toISOString();
}

export function createAuthHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
