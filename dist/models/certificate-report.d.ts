import { GoogleCertificateListCertificateItem, GcertApp } from "./gcert-app";
export declare class CertificateReport {
    static commonNames: Set<string>;
    domain: string;
    commonName: string;
    queriedDomain: string;
    lastIssuanceDate: Date;
    httpStatus?: number;
    resolvedIpAddress?: string;
    constructor(data: GoogleCertificateListCertificateItem, app: GcertApp, queriedDomain: string);
    getHttpStatus(): Promise<number | undefined>;
    resolve(): Promise<string | undefined>;
}
