import axios from "axios";
import dns from "dns/promises";
import { Color, log } from "../utils";
import { GsubApp } from "./gsub-app";

export class CertificateReport {
  static commonNames: Set<string> = new Set();

  public domain: string;
  public commonName: string;
  public queriedDomain: string;
  public date: Date;
  public httpStatus: number | null = null;
  public resolvedIpAddress: string | null = null;

  constructor(data: any, app: GsubApp, queriedDomain: string) {
    if (!data[1] || !data[3]) {
      throw new Error(
        "Missing common name or timestamp index in certificate data array"
      );
    }
    const commonName = data[1].toLowerCase();
    const timestamp = data[3];
    if (commonName.split(" ").length > 1) {
      throw new Error("Common name with whitespace");
    }
    if (CertificateReport.commonNames.has(commonName)) {
      // update already found report timestamp
      const certificateReport = app.certificateReports.find(
        (c) => c.commonName === commonName
      );
      if (certificateReport && certificateReport.date < timestamp) {
        certificateReport.date = new Date(timestamp);
      }

      throw new Error("Common name already done");
    }
    CertificateReport.commonNames.add(commonName);
    const splittedCN = commonName.split(".");
    const domain = splittedCN.slice(-2).join(".");
    if (
      !app.todoDomains.includes(domain) &&
      !app.doneDomains.includes(domain) &&
      !app.options.denyList.includes(domain)
    ) {
      log("New domain found : " + domain, Color.FgBlue);
      app.todoDomains.push(domain);
    }
    this.commonName = commonName;
    this.queriedDomain = queriedDomain;
    this.domain = domain;
    this.date = new Date(timestamp);
  }

  async getHttpStatus(): Promise<number | undefined> {
    try {
      if (!this.commonName) return;
      const response = await axios.get("http://" + this.commonName);
      this.httpStatus = response.status;
      return this.httpStatus;
    } catch (err) {}
  }
  async resolve(): Promise<string | undefined> {
    try {
      if (!this.commonName) return;
      const response = await dns.lookup(this.commonName);
      this.resolvedIpAddress = response.address;
      return this.resolvedIpAddress;
    } catch (err) {}
  }
}
