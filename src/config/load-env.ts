import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: resolve(process.cwd(), 'local.env'), override: true });

export default dotenv;
