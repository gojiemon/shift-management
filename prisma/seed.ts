import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.lineLinkCode.deleteMany();
  await prisma.lineLink.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.shiftPeriod.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      name: "店長",
      role: "ADMIN",
      loginId: "admin",
      passwordHash: adminPassword,
    },
  });
  console.log("Created admin:", admin.loginId);

  // Create staff users
  const staffPassword = await bcrypt.hash("staff123", 10);
  const staffData = [
    { name: "田中太郎", loginId: "tanaka" },
    { name: "佐藤花子", loginId: "sato" },
    { name: "鈴木一郎", loginId: "suzuki" },
  ];

  for (const staff of staffData) {
    const user = await prisma.user.create({
      data: {
        ...staff,
        role: "STAFF",
        passwordHash: staffPassword,
      },
    });
    console.log("Created staff:", user.loginId);
  }

  console.log("\n--- Seed completed ---");
  console.log("Admin login: admin / admin123");
  console.log("Staff login: tanaka, sato, suzuki / staff123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
