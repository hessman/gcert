import { GsubApp } from "./gsub-app";
export declare class CertificateReport {
    static commonNames: Set<string>;
    domain: string;
    commonName: string;
    queriedDomain: string;
    lastIssuanceDate: Date;
    httpStatus?: number;
    resolvedIpAddress?: string;
    constructor(data: any, app: GsubApp, queriedDomain: string);
    getHttpStatus(): Promise<number | undefined>;
    resolve(): Promise<string | undefined>;
}
