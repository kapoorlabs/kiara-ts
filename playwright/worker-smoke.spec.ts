import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

const root = process.cwd();

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requested = req.url ?? "/";
  const requestedUrl = new URL(requested, "http://127.0.0.1");
  const safePath = requestedUrl.pathname === "/" ? "/playwright/worker-smoke.html" : requestedUrl.pathname;
  const normalized = path.normalize(safePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, normalized);

  try {
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("content-type", contentType(filePath));
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("Not Found");
  }
}

test("browser worker smoke round-trip against dist artifact", async ({ page }) => {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not resolve HTTP test server address.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await page.goto(`${baseUrl}/playwright/worker-smoke.html`);
    await page.waitForFunction(() => (window as any).__workerSmokeResult !== undefined);

    const result = await page.evaluate(() => (window as any).__workerSmokeResult);
    expect(result.phases).toEqual(["accepted", "running", "completed"]);
    expect(result.response.ok).toBe(true);
    expect(result.response.result[0].title).toBe("Cast Away");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  }
});

test("browser worker stress scenarios on larger datasets and lifecycle churn", async ({ page }) => {
  test.setTimeout(120_000);

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not resolve HTTP test server address.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await page.goto(
      `${baseUrl}/playwright/worker-stress.html?rows=10000&repeats=20&concurrency=12&cancellationRaces=20&delayedCancellationMs=12&cancellationRows=2000`,
    );
    await page.waitForFunction(() => (window as any).__workerStressResult !== undefined, undefined, {
      timeout: 110_000,
    });

    const result = await page.evaluate(() => (window as any).__workerStressResult);
    expect(result.largeDatasetResponse.ok).toBe(true);
    expect(result.largeDatasetResponse.result[0].title).toBe("Movie 9999");
    expect(result.repeatedSuccesses).toBe(20);
    expect(result.concurrentSuccesses).toBe(12);
    expect(result.cancelledResponses).toBe(20);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  }
});

test("browser worker tiered stress on 50k rows with concurrency and cancellation races", async ({ page }) => {
  test.setTimeout(120_000);

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not resolve HTTP test server address.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await page.goto(
      `${baseUrl}/playwright/worker-stress.html?rows=50000&repeats=6&concurrency=8&cancellationRaces=8&delayedCancellationMs=20&cancellationRows=2000`,
    );
    await page.waitForFunction(() => (window as any).__workerStressResult !== undefined, undefined, {
      timeout: 110_000,
    });

    const result = await page.evaluate(() => (window as any).__workerStressResult);
    expect(result.rows).toBe(50000);
    expect(result.largeDatasetResponse.ok).toBe(true);
    expect(result.largeDatasetResponse.result[0].title).toBe("Movie 49999");
    expect(result.repeatedSuccesses).toBe(6);
    expect(result.concurrentSuccesses).toBe(8);
    expect(result.cancelledResponses).toBe(8);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  }
});
