import { GsubApp } from "./models";

(async () => {
  const app = new GsubApp();
  await app.getCNRecords();
  app.outputCertificateReports();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
