import { GcertItem } from "./gcert-item";
export interface GcertOptions {
    maxDepthLevel: number;
    outputFormat: OutputFormat;
    onlyResolved: boolean;
    resolve: boolean;
    domainDenyList: string[];
    wordDenyList: string[];
    initialTarget: string;
}
export declare enum OutputFormat {
    json = "json",
    csv = "csv",
    html = "html"
}
export declare type GoogleCertificateList = [
    [
        _: string,
        items: GoogleCertificateListCertificateItem[],
        _2: unknown,
        footer: GoogleCertificateListFooter
    ]
];
export declare type GoogleCertificateListCertificateItem = [
    _: unknown | null,
    subject: string,
    issuer: string,
    validFromTimestamp: number,
    validToTimestamp: number,
    detailsId: string,
    dnsNamesCount: number,
    _2: unknown | null,
    ctLogsCount: number
];
export declare type GoogleCertificateListFooter = [
    previousPageId: string,
    nextPageId: string,
    _: unknown | null,
    currentPage: number,
    pageCount: number
];
export declare type GoogleCertificateDetail = [
    [
        _: string,
        item: GoogleCertificateDetailItem,
        ctLogs: GoogleCertificateDetailCtLog
    ]
];
export declare type GoogleCertificateDetailItem = [
    serialNumber: string,
    subject: string,
    issuer: string,
    validFromTimestamp: number,
    validToTimestamp: number,
    _: unknown | null,
    _2: unknown | null,
    dnsNames: string[]
];
export declare type GoogleCertificateDetailCtLog = [
    name: string,
    _: unknown | null,
    _2: number
];
export declare class GcertApp {
    static readonly HEADER = "\n  __ _  ___ ___ _ __| |_ \n / _` |/ __/ _ \\ '__| __|\n| (_| | (_|  __/ |  | |_ \n \\__, |\\___\\___|_|   \\__|\n |___/";
    static readonly VERSION: any;
    static readonly DEFAULT_DEPTH_LEVEL = 0;
    static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
    static readonly GOOGLE_BASE_URL = "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct";
    items: GcertItem[];
    todoDomains: Set<string>;
    doneDomains: Set<string>;
    options: GcertOptions;
    constructor();
    getCertificateRecords(target?: string, depthLevel?: number): Promise<void>;
    outputCertificateReports(): void;
}
