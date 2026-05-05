/**
 * Seed script — creates the first admin user.
 * Run once: npx ts-node scripts/seed-admin.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Dynamically import model after connection
  const { UserModel } = await import('../src/modules/users/user.model');

  const existing = await UserModel.findOne({ email: 'admin@sat.edu' });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  await UserModel.create({
    email: 'admin@sat.edu',
    passwordHash,
    role: 'admin',
    name: 'System Admin',
    isActive: true,
  });

  console.log('\n✅ Admin user created!');
  console.log('   Email:    admin@sat.edu');
  console.log('   Password: Admin@123');
  console.log('\n⚠️  Change the password after first login.\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
