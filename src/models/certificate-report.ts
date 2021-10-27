import axios from "axios";
import dns from "dns/promises";
import { Color, log } from "../utils";
import { GoogleCertificateListCertificateItem, GcertApp } from "./gcert-app";

export class CertificateReport {
  static commonNames: Set<string> = new Set();

  public domain: string;
  public commonName: string;
  public queriedDomain: string;
  public lastIssuanceDate: Date;
  public httpStatus?: number;
  public resolvedIpAddress?: string;

  constructor(
    data: GoogleCertificateListCertificateItem,
    app: GcertApp,
    queriedDomain: string
  ) {
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
      // update already found report last issuance date
      const certificateReport = app.certificateReports.find(
        (c) => c.commonName === commonName
      );
      if (
        certificateReport &&
        certificateReport.lastIssuanceDate.getTime() < timestamp
      ) {
        certificateReport.lastIssuanceDate = new Date(timestamp);
      }
      throw new Error("Common name already done");
    }
    CertificateReport.commonNames.add(commonName);
    const splittedCN = commonName.split(".");
    const domain = splittedCN.slice(-2).join(".");
    if (app.options.denyList.includes(domain)) {
      throw new Error("Domain on deny list");
    }
    if (
      !app.todoDomains.has(domain) &&
      !app.doneDomains.has(domain) &&
      !app.options.denyList.includes(domain)
    ) {
      log("New domain found : " + domain, Color.FgBlue);
      app.todoDomains.add(domain);
    }
    this.commonName = commonName;
    this.queriedDomain = queriedDomain;
    this.domain = domain;
    this.lastIssuanceDate = new Date(timestamp);
  }

  async getHttpStatus(): Promise<number | undefined> {
    try {
      if (this.commonName.includes("*")) return;
      const op = async (protocol: "http" | "https") => {
        try {
          return await axios.get(`${protocol}://${this.commonName}`, {
            timeout: 5000,
          });
        } catch (err) {
          return undefined;
        }
      };
      const [httpResponse, httpsResponse] = await Promise.all([
        op("http"),
        op("https"),
      ]);
      this.httpStatus = httpsResponse?.status ?? httpResponse?.status;
      return this.httpStatus;
    } catch (err) {}
  }
  async resolve(): Promise<string | undefined> {
    try {
      if (this.commonName.includes("*")) return;
      const response = await dns.lookup(this.commonName);
      this.resolvedIpAddress = response.address;
      return this.resolvedIpAddress;
    } catch (err) {}
  }
}
