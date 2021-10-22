import axios from "axios";
import dns from "dns/promises";
import { GsubApp } from "./gsub-app";

export class CertificateReport {
  static commonNames: Set<string> = new Set();

  public domain: string | null = null;
  public CN: string | null = null;
  public status: number | null = null;
  public ipAddr: string | null = null;
  public fromDomain: string | null = null;

  constructor(data: any, app: GsubApp, fromDomain: string | null = null) {
    if (!data[1]) {
      throw new Error("Missing CN index in certificate data array");
    }
    const CN = data[1].toLowerCase();
    if (CN.split(" ").length > 1) {
      throw new Error("CN with whitespace");
    }
    if (CertificateReport.commonNames.has(CN)) {
      throw new Error("CN already done");
    }
    CertificateReport.commonNames.add(CN);
    const splittedCN = CN.split(".");
    const domain = splittedCN.slice(-2).join(".");
    if (
      !app.todoDomains.includes(domain) &&
      !app.doneDomains.includes(domain) &&
      !app.options.denyList.includes(domain)
    ) {
      console.error("\x1b[34m" + "New domain found : " + domain + "\x1b[0m")
      app.todoDomains.push(domain);
    }
    this.CN = CN;
    this.fromDomain = fromDomain;
    this.domain = domain;
  }

  async getHttpStatus(): Promise<number | undefined> {
    try {
      if (!this.CN) return;
      const response = await axios.get("http://" + this.CN);
      this.status = response.status;
      return this.status;
    } catch (err) {}
  }
  async resolve(): Promise<string | undefined> {
    try {
      if (!this.CN) return;
      const response = await dns.lookup(this.CN);
      this.ipAddr = response.address;
      return this.ipAddr;
    } catch (err) {}
  }
}
