import { GsubApp } from "./gsub-app";
export declare class CertificateReport {
    static commonNames: Set<string>;
    domain: string | null;
    CN: string | null;
    status: number | null;
    ipAddr: string | null;
    fromDomain: string | null;
    constructor(data: any, app: GsubApp, fromDomain?: string | null);
    getHttpStatus(): Promise<number | undefined>;
    resolve(): Promise<string | undefined>;
}
