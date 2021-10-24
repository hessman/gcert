import { CertificateReport } from "./certificate-report";
export interface GsubOptions {
    maxDepthLevel: number;
    outputFormat: OutputFormat;
    onlyResolved: boolean;
    resolve: boolean;
    denyList: string[];
    initialTarget: string;
}
export declare enum OutputFormat {
    json = "json",
    csv = "csv",
    html = "html"
}
export declare class GsubApp {
    static readonly HEADER = "\n  __ _ ___ _   _| |__  \n / _` / __| | | | '_ \\ \n| (_| \\__ \\ |_| | |_) |\n \\__, |___/\\__,_|_.__/ \n |___/";
    static readonly VERSION: any;
    static readonly DEFAULT_DEPTH_LEVEL = 0;
    static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
    static readonly GOOGLE_BASE_URL = "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch";
    certificateReports: CertificateReport[];
    todoDomains: Set<string>;
    doneDomains: Set<string>;
    options: GsubOptions;
    constructor();
    getCertificateRecords(target?: string, depthLevel?: number): Promise<void>;
    outputCertificateReports(): void;
}
