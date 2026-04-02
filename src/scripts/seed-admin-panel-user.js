/**
 * Creates or updates the default admin-panel login user (Mongo `User` with role `admin`).
 *
 * Run: npm run seed:admin-user
 * Requires MONGO_URI (and usual env) like other backend commands.
 */
import 'module-alias/register';

import User from '@/models/users/User';
import mongoDBServer from '@/servers/mongoDB-server';
import MainAuthService from '@/services/auth/MainAuth.service';
import { createNewUser } from '@/utils/helpers/auth';

const ADMIN_EMAIL = 'admin@twox.gg';
const ADMIN_USERNAME = 'twops';
const ADMIN_PASSWORD = 'testadmin123';

async function main() {
  await mongoDBServer.connect();

  const hash = await MainAuthService.hashPassword(ADMIN_PASSWORD);
  const email = ADMIN_EMAIL.toLowerCase();

  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = hash;
    existing.role = 'admin';
    existing.isEmailVerified = true;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Updated admin user: ${email}`);
  } else {
    await createNewUser({
      email,
      username: ADMIN_USERNAME,
      password: hash,
      role: 'admin',
      isEmailVerified: true,
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin user: ${email} (username: ${ADMIN_USERNAME})`);
  }

  await mongoDBServer.disconnect();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
