import { GcertApp } from "./models";
import { Color, log } from "./utils";

const app = new GcertApp();

process.on("SIGINT", () => {
  app.outputCertificateReports();
  process.exit(2);
});

(async () => {
  await app.getCertificateRecords();
  log(
    `${app.items.length} unique (sub)domain(s) found for ${app.options.initialTarget}`,
    Color.FgCyan
  );
  app.outputCertificateReports();
})().catch((err) => {
  log(err);
  process.exit(1);
});
