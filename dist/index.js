"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
const utils_1 = require("./utils");
process.on("SIGINT", () => {
    process.exit(2);
});
(async () => {
    const app = new models_1.GcertApp();
    await app.getCertificateRecords();
    app.outputCertificateReports();
})().catch((err) => {
    (0, utils_1.log)(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map