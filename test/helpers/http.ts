import { vi, type Mock } from "vitest";
import { Request, Response } from "express";

export type MockResponse = Response & { status: Mock; json: Mock };

export const createResponse = (overrides: Record<string, unknown> = {}): MockResponse => {
    const res: Record<string, unknown> = { status: vi.fn(), json: vi.fn(), headersSent: false, ...overrides };
    (res.status as Mock).mockReturnValue(res);
    return res as unknown as MockResponse;
};

export const createRequest = (parts: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, unknown>;
}): Request =>
    ({
        body: parts.body ?? {},
        params: parts.params ?? {},
        query: parts.query ?? {},
    }) as unknown as Request;
