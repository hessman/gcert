"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("./models");
(async () => {
    const app = new models_1.GsubApp();
    await app.getCNRecords();
    app.outputCertificateReports();
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map