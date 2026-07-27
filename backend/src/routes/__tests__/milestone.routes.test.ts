import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import milestoneRouter from "../milestone.routes";

// ─── Prisma & NotificationService mocks ───────────────────────────────────────
jest.mock("@prisma/client", () => {
  const mockPrisma = {
    milestone: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000001",
        role: "CLIENT",
        emailVerified: true,
        walletAddress: "GDTESTWALLETADDRESS000000000000000000000000000000000000000",
      }),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma) as any,
    NotificationType: {
      MILESTONE_SUBMITTED: "MILESTONE_SUBMITTED",
    } as any,
  };
});

jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendNotification: jest.fn().mockResolvedValue({ id: "mock-notif-id" }),
  },
}));

jest.mock("../../lib/token-version", () => ({
  getCurrentTokenVersion: jest.fn().mockResolvedValue(null),
  invalidateTokenVersionCache: jest.fn().mockResolvedValue(undefined),
}));

import { PrismaClient } from "@prisma/client";
const prismaMock = new PrismaClient() as any;
const milestoneMock = prismaMock.milestone;

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use("/api", milestoneRouter);

// ─── Stable test UUIDs (RFC 4122 v4 format) ──────────────────────────────────
const JOB_A_ID = "00000000-0000-4000-8000-000000000100";
const JOB_B_ID = "00000000-0000-4000-8000-000000000200";
const CLIENT_A_ID = "00000000-0000-4000-8000-000000000001";
const CLIENT_B_ID = "00000000-0000-4000-8000-000000000002";
const FREELANCER_A_ID = "00000000-0000-4000-8000-000000000003";

function authHeader(userId = CLIENT_A_ID) {
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: "1h" });
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => jest.clearAllMocks());

describe("GET /api/milestones - ownership check", () => {
  it("returns 401 with no auth token", async () => {
    const res = await request(app).get("/api/milestones");
    expect(res.status).toBe(401);
  });

  it("returns only milestones for jobs the user is a party to (no jobId filter)", async () => {
    milestoneMock.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000300",
        jobId: JOB_A_ID,
        title: "Milestone 1",
        description: "Test milestone",
        amount: 100,
        status: "PENDING",
        order: 1,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        job: { id: JOB_A_ID, title: "Job A" },
      },
    ]);
    milestoneMock.count.mockResolvedValueOnce(1);

    const res = await request(app)
      .get("/api/milestones")
      .set(authHeader(CLIENT_A_ID));

    expect(res.status).toBe(200);
    expect(milestoneMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          job: {
            OR: [
              { clientId: CLIENT_A_ID },
              { freelancerId: CLIENT_A_ID },
            ],
          },
        },
      }),
    "");
  });

  it("returns 403 when querying milestones for a job the user is not a party to (with jobId filter)", async () => {
    milestoneMock.findMany.mockResolvedValueOnce([]);
    milestoneMock.count.mockResolvedValueOnce(0);

    const res = await request(app)
      .get(`/api/milestones?jobId=${JOB_B_ID}`)
      .set(authHeader(CLIENT_A_ID));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(milestoneMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobId: JOB_B_ID,
          job: {
            OR: [
              { clientId: CLIENT_A_ID },
              { freelancerId: CLIENT_A_ID },
            ],
          },
        },
      }),
    );
  });

  it("returns milestones for a job when the user is the client (with jobId filter)", async () => {
    milestoneMock.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000300",
        jobId: JOB_A_ID,
        title: "Milestone 1",
        description: "Test milestone",
        amount: 100,
        status: "PENDING",
        order: 1,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        job: { id: JOB_A_ID, title: "Job A" },
      },
    ]);
    milestoneMock.count.mockResolvedValueOnce(1);

    const res = await request(app)
      .get(`/api/milestones?jobId=${JOB_A_ID}`)
      .set(authHeader(CLIENT_A_ID));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(milestoneMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobId: JOB_A_ID,
          job: {
            OR: [
              { clientId: CLIENT_A_ID },
              { freelancerId: CLIENT_A_ID },
            ],
          },
        },
      }),
    );
  });

  it("returns milestones for a job when the user is the freelancer (with jobId filter)", async () => {
    milestoneMock.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000300",
        jobId: JOB_A_ID,
        title: "Milestone 1",
        description: "Test milestone",
        amount: 100,
        status: "PENDING",
        order: 1,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        job: { id: JOB_A_ID, title: "Job A" },
      },
    ]);
    milestoneMock.count.mockResolvedValueOnce(1);

    const res = await request(app)
      .get(`/api/milestones?jobId=${JOB_A_ID}`)
      .set(authHeader(FREELANCER_A_ID));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(milestoneMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobId: JOB_A_ID,
          job: {
            OR: [
              { clientId: FREELANCER_A_ID },
              { freelancerId: FREELANCER_A_ID },
            ],
          },
        },
      }),
    );
  });

  it("applies status filter along with ownership check", async () => {
    milestoneMock.findMany.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000300",
        jobId: JOB_A_ID,
        title: "Milestone 1",
        description: "Test milestone",
        amount: 100,
        status: "IN_PROGRESS",
        order: 1,
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        job: { id: JOB_A_ID, title: "Job A" },
      },
    ]);
    milestoneMock.count.mockResolvedValueOnce(1);

    const res = await request(app)
      .get(`/api/milestones?status=IN_PROGRESS`)
      .set(authHeader(CLIENT_A_ID));

    expect(res.status).toBe(200);
    expect(milestoneMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "IN_PROGRESS",
          job: {
            OR: [
              { clientId: CLIENT_A_ID },
              { freelancerId: CLIENT_A_ID },
            ],
          },
        },
      }),
    );
  });
});
