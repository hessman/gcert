import { GcertApp } from "./models";
import { log } from "./utils";

process.on("SIGINT", () => {
  process.exit(2);
});

(async () => {
  const app = new GcertApp();
  await app.getCertificateRecords();
  app.outputCertificateReports();
})().catch((err) => {
  log(err);
  process.exit(1);
});
