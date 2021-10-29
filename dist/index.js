"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
const utils_1 = require("./utils");
const app = new models_1.GcertApp();
process.on("SIGINT", () => {
    app.outputCertificateReports();
    process.exit(2);
});
(async () => {
    await app.getCertificateRecords();
    app.outputCertificateReports();
})().catch((err) => {
    (0, utils_1.log)(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map