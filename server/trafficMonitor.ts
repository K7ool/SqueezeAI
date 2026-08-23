import { Request, Response, NextFunction } from 'express';

export interface RouteTrafficStat {
  route: string;
  method: string;
  requestCount: number;
  totalBytesTransferred: number; // in bytes
  averageBytes: number;
  statusCodeCounts: Record<number, number>;
  lastAccess: string;
}

export interface OriginTrafficMetrics {
  startTime: string;
  totalRequests: number;
  totalBytesTransferred: number;
  totalMegabytesTransferred: number;
  totalGigabytesTransferred: number;
  compressedRequests: number;
  notModifiedRequests: number; // 304s
  botBlockedRequests: number;
  rateLimitedRequests: number;
  topRoutesByBandwidth: RouteTrafficStat[];
  recentRequests: Array<{
    timestamp: string;
    method: string;
    path: string;
    status: number;
    bytes: number;
    ip: string;
    userAgent: string;
    durationMs: number;
  }>;
}

class TrafficMonitor {
  private startTime = new Date().toISOString();
  private totalRequests = 0;
  private totalBytesTransferred = 0;
  private compressedRequests = 0;
  private notModifiedRequests = 0;
  private botBlockedRequests = 0;
  private rateLimitedRequests = 0;
  private routeStats = new Map<string, RouteTrafficStat>();
  private recentRequests: Array<{
    timestamp: string;
    method: string;
    path: string;
    status: number;
    bytes: number;
    ip: string;
    userAgent: string;
    durationMs: number;
  }> = [];

  private readonly MAX_RECENT_LOGS = 100;

  public recordRequest(
    method: string,
    path: string,
    status: number,
    bytes: number,
    ip: string,
    userAgent: string,
    durationMs: number,
    isCompressed: boolean
  ) {
    this.totalRequests++;
    this.totalBytesTransferred += bytes;

    if (isCompressed) this.compressedRequests++;
    if (status === 304) this.notModifiedRequests++;
    if (status === 429) this.rateLimitedRequests++;
    if (status === 403 && userAgent.toLowerCase().includes('bot')) this.botBlockedRequests++;

    // Normalize path to prevent high cardinality (e.g., replace IDs)
    const normalizedRoute = this.normalizePath(path);
    const key = `${method}:${normalizedRoute}`;

    let stat = this.routeStats.get(key);
    if (!stat) {
      stat = {
        route: normalizedRoute,
        method,
        requestCount: 0,
        totalBytesTransferred: 0,
        averageBytes: 0,
        statusCodeCounts: {},
        lastAccess: new Date().toISOString()
      };
      this.routeStats.set(key, stat);
    }

    stat.requestCount++;
    stat.totalBytesTransferred += bytes;
    stat.averageBytes = Math.round(stat.totalBytesTransferred / stat.requestCount);
    stat.statusCodeCounts[status] = (stat.statusCodeCounts[status] || 0) + 1;
    stat.lastAccess = new Date().toISOString();

    // Add to ring buffer of recent requests
    this.recentRequests.unshift({
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      bytes,
      ip: ip.replace(/:\d+$/, ''),
      userAgent: userAgent.slice(0, 60),
      durationMs
    });

    if (this.recentRequests.length > this.MAX_RECENT_LOGS) {
      this.recentRequests.pop();
    }
  }

  public recordBotBlock() {
    this.botBlockedRequests++;
  }

  public recordRateLimit() {
    this.rateLimitedRequests++;
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\/api\/conversations\/[a-zA-Z0-9_-]+/g, '/api/conversations/:id')
      .replace(/\/api\/scripts\/[a-zA-Z0-9_-]+/g, '/api/scripts/:id')
      .replace(/\/assets\/[a-zA-Z0-9_-]+\.[a-z0-9]+/gi, '/assets/[hash].ext')
      .replace(/\?.*$/, ''); // strip query params
  }

  public getMetrics(): OriginTrafficMetrics {
    const topRoutes = Array.from(this.routeStats.values())
      .sort((a, b) => b.totalBytesTransferred - a.totalBytesTransferred)
      .slice(0, 20);

    const mb = this.totalBytesTransferred / (1024 * 1024);
    const gb = mb / 1024;

    return {
      startTime: this.startTime,
      totalRequests: this.totalRequests,
      totalBytesTransferred: this.totalBytesTransferred,
      totalMegabytesTransferred: Number(mb.toFixed(2)),
      totalGigabytesTransferred: Number(gb.toFixed(4)),
      compressedRequests: this.compressedRequests,
      notModifiedRequests: this.notModifiedRequests,
      botBlockedRequests: this.botBlockedRequests,
      rateLimitedRequests: this.rateLimitedRequests,
      topRoutesByBandwidth: topRoutes,
      recentRequests: this.recentRequests.slice(0, 30)
    };
  }

  public reset() {
    this.totalRequests = 0;
    this.totalBytesTransferred = 0;
    this.compressedRequests = 0;
    this.notModifiedRequests = 0;
    this.botBlockedRequests = 0;
    this.rateLimitedRequests = 0;
    this.routeStats.clear();
    this.recentRequests = [];
    this.startTime = new Date().toISOString();
  }
}

export const trafficMonitor = new TrafficMonitor();

/**
 * Express middleware to measure payload egress bytes and log transfer stats
 */
export function trafficMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  let bytesWritten = 0;

  // Intercept write and end to count exact response size
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk: any, ...args: any[]): boolean {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        bytesWritten += chunk.length;
      } else if (typeof chunk === 'string') {
        bytesWritten += Buffer.byteLength(chunk);
      }
    }
    return (originalWrite as any).apply(res, [chunk, ...args]);
  };

  res.end = function (chunk?: any, ...args: any[]): any {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        bytesWritten += chunk.length;
      } else if (typeof chunk === 'string') {
        bytesWritten += Buffer.byteLength(chunk);
      }
    }

    const duration = Date.now() - start;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const isCompressed = !!(res.getHeader('content-encoding'));

    // If headers provided Content-Length and bytesWritten is 0 (e.g. sendFile or piped response)
    const headerContentLength = res.getHeader('content-length');
    const finalBytes = bytesWritten || (headerContentLength ? Number(headerContentLength) : 0);

    trafficMonitor.recordRequest(
      req.method,
      req.path || req.url,
      res.statusCode,
      finalBytes,
      ip,
      userAgent,
      duration,
      isCompressed
    );

    return (originalEnd as any).apply(res, [chunk, ...args]);
  };

  next();
}
