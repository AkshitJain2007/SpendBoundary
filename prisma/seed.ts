import { PrismaClient } from "@prisma/client";
import { DEMO_PRODUCTS, DEMO_POLICY } from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SpendBoundary SQLite database...");

  // Clean existing demo records
  await prisma.auditEvent.deleteMany({});
  await prisma.paymentAttempt.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.policyDecision.deleteMany({});
  await prisma.agentRequest.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.policy.deleteMany({});

  // Seed Products
  for (const prod of DEMO_PRODUCTS) {
    await prisma.product.create({
      data: {
        id: prod.id,
        name: prod.name,
        category: prod.category,
        pricePaise: prod.pricePaise,
        stock: prod.stock,
        allowed: prod.allowed,
        description: prod.description,
      },
    });
  }
  console.log(`✅ Seeded ${DEMO_PRODUCTS.length} synthetic products.`);

  // Seed Policy
  await prisma.policy.create({
    data: {
      id: DEMO_POLICY.id,
      merchantId: DEMO_POLICY.merchantId,
      maxOrderPaise: DEMO_POLICY.maxOrderPaise,
      dailyLimitPaise: DEMO_POLICY.dailyLimitPaise,
      velocityCount: DEMO_POLICY.velocityCount,
      velocityWindowSeconds: DEMO_POLICY.velocityWindowSeconds,
      allowedCategories: JSON.stringify(DEMO_POLICY.allowedCategories),
      approvalThresholdPaise: DEMO_POLICY.approvalThresholdPaise,
      version: DEMO_POLICY.version,
    },
  });
  console.log(`✅ Seeded demo policy ${DEMO_POLICY.id} (version: ${DEMO_POLICY.version}).`);

  // Genesis Audit Event
  await prisma.auditEvent.create({
    data: {
      eventType: "SYSTEM_GENESIS",
      requestId: "genesis",
      payloadJson: JSON.stringify({
        message: "SpendBoundary Genesis Audit Block Created",
        merchantId: DEMO_POLICY.merchantId,
        timestamp: new Date().toISOString(),
      }),
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      eventHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // standard sha256 placeholder for genesis
    },
  });
  console.log("✅ Seeded Genesis Audit Event.");

  console.log("🚀 SpendBoundary seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
