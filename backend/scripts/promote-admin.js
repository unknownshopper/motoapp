// Usage: EMAIL=admin@demo.com node scripts/promote-admin.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL;
  if (!email) {
    console.error('Set EMAIL env var. Example: EMAIL=admin@demo.com node scripts/promote-admin.js');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(2);
  }
  const updated = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log('Updated user role:', { id: updated.id, email: updated.email, role: updated.role });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
