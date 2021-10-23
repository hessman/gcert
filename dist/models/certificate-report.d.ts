import { GsubApp } from "./gsub-app";
export declare class CertificateReport {
    static commonNames: Set<string>;
    domain: string;
    commonName: string;
    queriedDomain: string;
    date: Date;
    httpStatus: number | null;
    resolvedIpAddress: string | null;
    constructor(data: any, app: GsubApp, queriedDomain: string);
    getHttpStatus(): Promise<number | undefined>;
    resolve(): Promise<string | undefined>;
}
