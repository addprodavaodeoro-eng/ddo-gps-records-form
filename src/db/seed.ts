import { db } from './index.ts';
import { locales, users } from './schema.ts';
import { hashPassword } from '../utils/crypto.ts';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  console.log('Starting database seeding...');
  try {
    // 1. Seed predefined locales
    const predefinedLocales = [
      'Nabunturan',
      'Mawab',
      'Montevista',
      'Prosperidad',
      'Monkayo',
      'Rizal',
      'Diwalwal',
      'New Bataan',
      'Mainit',
      'Tandawan',
      'Maragusan',
      'Compostela'
    ];

    // Check existing locales
    const existingLocalesList = await db.select().from(locales);
    const existingNames = new Set(existingLocalesList.map(l => l.name));

    for (const localeName of predefinedLocales) {
      if (!existingNames.has(localeName)) {
        await db.insert(locales).values({ name: localeName });
        console.log(`Seeded locale: ${localeName}`);
      }
    }

    // 2. Seed default Super Admin user
    const existingAdmins = await db.select().from(users).where(eq(users.username, 'Admin'));
    if (existingAdmins.length === 0) {
      const passwordHash = hashPassword('mcgiddo');
      await db.insert(users).values({
        username: 'Admin',
        passwordHash,
        role: 'Super Admin',
        mustChangePassword: true,
        email: 'addpro.davaodeoro@gmail.com', // User email
      });
      console.log('Seeded default Super Admin user: Admin / mcgiddo (requires password change on first login)');
    }

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
