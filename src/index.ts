import { GsubApp } from "./models";
import { log } from "./utils";

process.on("SIGINT", () => {
  process.exit(2);
});

(async () => {
  const app = new GsubApp();
  await app.getCertificateRecords();
  app.outputCertificateReports();
})().catch((err) => {
  log(err);
  process.exit(1);
});
