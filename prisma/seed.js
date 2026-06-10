"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const system_settings_seed_1 = require("../src/modules/system-settings/system-settings.seed");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding system settings...');
    await (0, system_settings_seed_1.seedSystemSettings)(prisma);
    console.log('Seed complete.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map