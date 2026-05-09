import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  const schoolName = 'Silver Hills';
  
  const school = await prisma.school.findFirst({
    where: { name: schoolName },
    include: {
      memberships: {
        include: {
          user: true
        }
      }
    }
  });

  if (!school) {
    console.log(`School "${schoolName}" not found.`);
  } else {
    console.log(`School: ${school.name} (${school.id})`);
    console.log(`Members count: ${school.memberships.length}`);
    school.memberships.forEach(m => {
      console.log(`- ${m.user.email} (Role: ${m.role}, ID: ${m.userId})`);
    });
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
