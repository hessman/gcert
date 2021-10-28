import { GcertApp } from "./gcert-app";
export interface GcertItemCreationPayload {
    dnsName: string;
    domains: Set<string>;
    domain: string;
    queriedDomain: string;
    issuanceDate: Date;
}
export declare class GcertItem {
    static dnsNames: Set<string>;
    linkedDomains: Set<string>;
    domain: string;
    dnsName: string;
    queriedDomain: string;
    lastIssuanceDate: Date;
    httpStatus?: number;
    resolvedIpAddress?: string;
    constructor(payload: GcertItemCreationPayload, app: GcertApp);
    getHttpStatus(): Promise<number | undefined>;
    resolve(): Promise<string | undefined>;
}
