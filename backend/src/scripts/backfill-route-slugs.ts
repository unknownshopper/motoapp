import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function makeUniqueSlug(baseName: string, excludeId?: string) {
  const base = slugify(baseName);
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = await prisma.route.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      } as any,
    });
    if (!found) return candidate;
    candidate = `${base}-${i++}`;
  }
}

async function main() {
  const routes = await prisma.route.findMany();
  for (const r of routes) {
    const currentSlug = (r as any).slug as string | null | undefined;
    if (!currentSlug || currentSlug === null) {
      const slug = await makeUniqueSlug(r.name, r.id);
      await prisma.route.update({ where: { id: r.id }, data: { slug } as any });
      // eslint-disable-next-line no-console
      console.log(`Updated route ${r.name} -> slug: ${slug}`);
    }
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
