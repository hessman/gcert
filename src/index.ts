import { GcertApp } from "./models";
import { log } from "./utils";

const app = new GcertApp();

process.on("SIGINT", () => {
  app.outputCertificateReports();
  process.exit(2);
});

(async () => {
  await app.getCertificateRecords();
  app.outputCertificateReports();
})().catch((err) => {
  log(err);
  process.exit(1);
});
