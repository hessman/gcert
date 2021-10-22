import { CertificateReport } from "./certificate-report";
export interface GsubOptions {
    maxDepthLevel: number;
    outputFormat: OutputFormat;
    onlyResolved: boolean;
    denyList: string[];
    initialTarget: string;
}
export declare enum OutputFormat {
    json = "json",
    csv = "csv",
    html = "html"
}
export declare class GsubApp {
    static readonly DEFAULT_DEPTH_LEVEL = 0;
    static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
    static readonly GOOGLE_BASE_URL = "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch";
    certificateReports: CertificateReport[];
    todoDomains: string[];
    doneDomains: string[];
    options: GsubOptions;
    constructor();
    getCNRecords(target?: string, depthLevel?: number): Promise<void>;
    outputCertificateReports(): void;
}
