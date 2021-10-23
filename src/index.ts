import { GsubApp } from "./models";

process.on('SIGINT', () => {
  process.exit(2);
});

(async () => {
  const app = new GsubApp();
  await app.getCNRecords();
  app.outputCertificateReports();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
